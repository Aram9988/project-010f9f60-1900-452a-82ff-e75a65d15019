import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X } from "lucide-react";
import type { Attachment } from "@/lib/types";
import { toast } from "sonner";

const ACCEPT = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf";
const MAX_MB = 25;

function guessKind(mime: string, name: string): Attachment["kind"] {
  if (mime.startsWith("image/")) return name.toLowerCase().includes("screenshot") ? "screenshot" : "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("word") || name.match(/\.(docx?|rtf)$/i)) return "word";
  if (mime.includes("excel") || mime.includes("spreadsheet") || name.match(/\.(xlsx?|csv)$/i)) return "excel";
  if (name.match(/\.(dwg|dxf|vsd)$/i)) return "drawing";
  return "image";
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + " KB";
  return (bytes/1024/1024).toFixed(2) + " MB";
}

export function AttachmentPicker({ onChange }: { onChange: (list: Attachment[]) => void }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const out: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${f.name} أكبر من الحد المسموح (${MAX_MB}MB)`); continue; }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(f);
      });
      out.push({
        id: "att_" + Math.random().toString(36).slice(2, 9),
        name: f.name, mime: f.type || "application/octet-stream",
        kind: guessKind(f.type || "", f.name),
        size: fmtSize(f.size), dataUrl,
      });
    }
    const next = [...items, ...out];
    setItems(next); onChange(next);
  }

  function remove(id: string) {
    const next = items.filter((x) => x.id !== id);
    setItems(next); onChange(next);
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        className={"rounded-lg border-2 border-dashed p-4 text-center text-sm text-muted-foreground " + (drag ? "border-primary bg-primary/5" : "border-border")}
      >
        <Paperclip className="mx-auto h-5 w-5 mb-1" />
        اسحب الملفات هنا أو
        <Button type="button" variant="link" className="px-1" onClick={() => ref.current?.click()}>اختر ملفات</Button>
        <div className="text-[11px]">PDF · صور · Word · Excel · رسومات — حتى {MAX_MB}MB</div>
        <input ref={ref} type="file" multiple accept={ACCEPT} className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
      </div>
      {items.length > 0 && (
        <ul className="mt-2 divide-y rounded-md border">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between p-2 text-xs">
              <span className="truncate">{a.name} <span className="text-muted-foreground">· {a.size}</span></span>
              <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><X className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
