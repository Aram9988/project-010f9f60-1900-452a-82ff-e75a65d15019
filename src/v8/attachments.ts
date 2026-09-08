import type { AttachmentRef } from "../v2/model";
import { WORKSPACE_SYNC_KEY_STORAGE } from "./liveState";

const ENDPOINT = "https://fxpnnmtlopuunptiaval.supabase.co/functions/v1/workspace-sync";
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function workspaceKey() {
  return typeof window === "undefined" ? "" : localStorage.getItem(WORKSPACE_SYNC_KEY_STORAGE) ?? "";
}

export async function uploadWorkspaceAttachment(file: File): Promise<AttachmentRef> {
  if (!file.size) throw new Error("empty_file");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("file_too_large");
  const key = workspaceKey();
  if (!key) throw new Error("workspace_not_connected");

  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${ENDPOINT}?attachment=upload`, {
    method: "POST",
    headers: { "x-workspace-key": key },
    body: form,
  });
  if (!res.ok) throw new Error(`upload_failed_${res.status}`);
  return await res.json() as AttachmentRef;
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

export function attachmentLabel(value: string | AttachmentRef) {
  return typeof value === "string" ? value : value.name;
}
