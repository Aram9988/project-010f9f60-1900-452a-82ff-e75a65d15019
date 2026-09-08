import type { AttachmentRef } from "../v2/model";
import { WORKSPACE_SYNC_KEY_STORAGE } from "./liveState";

const ENDPOINT = "https://fxpnnmtlopuunptiaval.supabase.co/functions/v1/workspace-sync";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Rf0WyT-WkcYbytquLvqcMw_1kZ0QMiD";
const ATTACHMENT_PREFIX = "__workspace_attachment_v1__:";
const TUS_VERSION = "1.0.0";
const TUS_CHUNK_BYTES = 6 * 1024 * 1024;

function workspaceKey() {
  return typeof window === "undefined" ? "" : localStorage.getItem(WORKSPACE_SYNC_KEY_STORAGE) ?? "";
}

function utf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function metadata(values: Record<string, string>) {
  return Object.entries(values).map(([key, value]) => `${key} ${utf8Base64(value)}`).join(",");
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type SignedUpload = {
  path: string;
  name: string;
  mime: string;
  size: number;
  token: string;
  tusEndpoint: string;
  bucket: string;
};

async function getSignedUpload(file: File, key: string): Promise<SignedUpload> {
  const params = new URLSearchParams({
    attachment: "sign-upload",
    name: file.name || "attachment",
    mime: file.type || "application/octet-stream",
    size: String(file.size),
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    method: "POST",
    headers: { "x-workspace-key": key },
  });
  if (!res.ok) throw new Error(`sign_upload_failed_${res.status}`);
  return await res.json() as SignedUpload;
}

function tusHeaders(token: string, extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    "x-signature": token,
    "Tus-Resumable": TUS_VERSION,
    ...extra,
  };
}

async function recoverOffset(uploadUrl: string, token: string) {
  const res = await fetch(uploadUrl, {
    method: "HEAD",
    headers: tusHeaders(token),
  });
  if (!res.ok) return null;
  const value = Number(res.headers.get("Upload-Offset") ?? "");
  return Number.isFinite(value) ? value : null;
}

async function uploadResumable(file: File, signed: SignedUpload) {
  const createRes = await fetch(signed.tusEndpoint, {
    method: "POST",
    headers: tusHeaders(signed.token, {
      "Upload-Length": String(file.size),
      "Upload-Metadata": metadata({
        bucketName: signed.bucket,
        objectName: signed.path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      }),
      "x-upsert": "false",
    }),
  });
  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => "");
    throw new Error(`tus_create_failed_${createRes.status}${detail ? `_${detail.slice(0, 160)}` : ""}`);
  }

  const location = createRes.headers.get("Location");
  if (!location) throw new Error("tus_location_missing");
  const uploadUrl = new URL(location, signed.tusEndpoint).toString();
  let offset = 0;

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(file.size, offset + TUS_CHUNK_BYTES));
    let uploaded = false;

    for (let attempt = 0; attempt < 5 && !uploaded; attempt += 1) {
      try {
        const res = await fetch(uploadUrl, {
          method: "PATCH",
          headers: tusHeaders(signed.token, {
            "Upload-Offset": String(offset),
            "Content-Type": "application/offset+octet-stream",
          }),
          body: chunk,
        });
        if (res.ok) {
          const nextOffset = Number(res.headers.get("Upload-Offset") ?? offset + chunk.size);
          offset = Number.isFinite(nextOffset) ? nextOffset : offset + chunk.size;
          uploaded = true;
          continue;
        }
      } catch {
        // Recover the server-side offset below before retrying.
      }

      const recovered = await recoverOffset(uploadUrl, signed.token);
      if (recovered !== null && recovered !== offset) {
        offset = recovered;
        uploaded = true;
        continue;
      }
      await wait(600 * (attempt + 1));
    }

    if (!uploaded) throw new Error("tus_chunk_failed");
  }
}

async function uploadLegacyFallback(file: File, key: string): Promise<AttachmentRef> {
  const form = new FormData();
  form.append("file", file, file.name || "attachment");
  const res = await fetch(`${ENDPOINT}?attachment=upload`, {
    method: "POST",
    headers: { "x-workspace-key": key },
    body: form,
  });
  if (!res.ok) throw new Error(`fallback_upload_failed_${res.status}`);
  return await res.json() as AttachmentRef;
}

export async function uploadWorkspaceAttachment(file: File): Promise<AttachmentRef> {
  if (!file.size) throw new Error("empty_file");
  const key = workspaceKey();
  if (!key) throw new Error("workspace_not_connected");

  try {
    const signed = await getSignedUpload(file, key);
    await uploadResumable(file, signed);
    return { path: signed.path, name: signed.name, mime: signed.mime, size: file.size };
  } catch (resumableError) {
    // Keep uploads operational on browsers/networks that block TUS. The fallback is
    // the previously working Edge Function path and is especially useful for small PDFs/images.
    try {
      return await uploadLegacyFallback(file, key);
    } catch (fallbackError) {
      const primary = resumableError instanceof Error ? resumableError.message : "resumable_upload_failed";
      const secondary = fallbackError instanceof Error ? fallbackError.message : "fallback_upload_failed";
      throw new Error(`${primary}|${secondary}`);
    }
  }
}

export async function openWorkspaceAttachment(attachment: AttachmentRef) {
  const key = workspaceKey();
  if (!key) throw new Error("workspace_not_connected");
  const res = await fetch(`${ENDPOINT}?attachment=download&path=${encodeURIComponent(attachment.path)}`, {
    headers: { "x-workspace-key": key },
  });
  if (!res.ok) throw new Error(`download_failed_${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.name || "attachment";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function serializeAttachment(value: AttachmentRef) {
  return `${ATTACHMENT_PREFIX}${JSON.stringify(value)}`;
}

export function parseAttachment(value?: string | AttachmentRef): AttachmentRef | null {
  if (!value) return null;
  if (typeof value !== "string") return value;
  if (!value.startsWith(ATTACHMENT_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(ATTACHMENT_PREFIX.length)) as Partial<AttachmentRef>;
    if (!parsed.path || !parsed.name) return null;
    return { path: parsed.path, name: parsed.name, mime: parsed.mime, size: parsed.size };
  } catch {
    return null;
  }
}

export function attachmentLabel(value: string | AttachmentRef) {
  const parsed = parseAttachment(value);
  return parsed?.name ?? (typeof value === "string" ? value : value.name);
}
