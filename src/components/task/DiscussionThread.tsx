import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { discussionService } from "@/services/discussionService";
import { getUser } from "@/services/userService";
import { useSession } from "@/lib/store";
import type { Comment, CommentType } from "@/lib/types";
import { COMMENT_TYPE_LABELS, ROLE_LABELS } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertOctagon, CheckCheck, CornerDownLeft, EyeOff, MessageSquare, Pin, Reply, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const typeIcon: Record<CommentType, React.ComponentType<{ className?: string }>> = {
  comment: MessageSquare, instruction: ShieldAlert, question: AlertOctagon,
  update: CheckCheck, revision_request: Reply, internal_note: EyeOff,
};
const typeColor: Record<CommentType, string> = {
  comment: "text-foreground", instruction: "text-gold-foreground",
  question: "text-info", update: "text-success-foreground",
  revision_request: "text-destructive", internal_note: "text-muted-foreground",
};

export function DiscussionThread({ taskId, filter = "all" }: { taskId: string; filter?: "all" | "discussion" | "instructions" }) {
  const qc = useQueryClient();
  const currentUserId = useSession((s) => s.currentUserId);
  const currentUser = getUser(currentUserId);
  const canFormal = currentUser?.role === "boss" || currentUser?.role === "associate";

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => discussionService.listForTask(taskId),
  });

  const [body, setBody] = useState("");
  const [type, setType] = useState<CommentType>("comment");
  const [formal, setFormal] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "instructions") return comments.filter((c) => c.isFormalInstruction);
    return comments;
  }, [comments, filter]);

  const roots = filtered.filter((c) => !c.parentId);
  const childrenOf = (id: string) => comments.filter((c) => c.parentId === id);

  async function submit() {
    if (!body.trim()) return;
    await discussionService.add({
      taskId, authorId: currentUserId, body: body.trim(), type,
      parentId: replyTo ?? undefined,
      isFormalInstruction: canFormal && formal,
    });
    setBody(""); setReplyTo(null); setFormal(false); setType("comment");
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
    toast.success("تمت الإضافة");
  }

  async function ack(commentId: string) {
    await discussionService.acknowledge(commentId, currentUserId);
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
    toast.success("تم تأكيد الاستلام");
  }

  return (
    <div className="space-y-4">
      {roots.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          لا توجد رسائل حتى الآن. ابدأ النقاش بكتابة أول تعليق.
        </div>
      )}
      {roots.map((c) => (
        <CommentItem key={c.id} c={c} childrenList={childrenOf(c.id)} onReply={setReplyTo} onAck={ack} currentUserId={currentUserId} />
      ))}

      <div className="sticky bottom-0 rounded-xl border border-border bg-card p-3 shadow-sm">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-muted px-2 py-1 text-xs">
            <span>الرد على تعليق سابق</span>
            <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>إلغاء</Button>
          </div>
        )}
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب تعليقك أو توجيهك…" className="min-h-20 resize-none border-0 focus-visible:ring-0 shadow-none p-2" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Select value={type} onValueChange={(v) => setType(v as CommentType)}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(COMMENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canFormal && (
              <div className="flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-2 py-1">
                <Switch id="formal" checked={formal} onCheckedChange={setFormal} />
                <Label htmlFor="formal" className="text-xs font-medium cursor-pointer">توجيه رسمي</Label>
              </div>
            )}
          </div>
          <Button onClick={submit} className="gap-1">
            <CornerDownLeft className="h-4 w-4" />
            إرسال
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentItem({ c, childrenList, onReply, onAck, currentUserId }: {
  c: Comment; childrenList: Comment[]; onReply: (id: string) => void;
  onAck: (id: string) => void; currentUserId: string;
}) {
  const author = getUser(c.authorId);
  const acker = c.acknowledgedByUserId ? getUser(c.acknowledgedByUserId) : undefined;
  const Icon = typeIcon[c.type];
  const needsAck = c.isFormalInstruction && !c.acknowledgedByUserId;

  if (c.hidden) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/50 p-3 text-sm text-muted-foreground">
        تم إخفاء هذا التعليق بواسطة المسؤول
      </div>
    );
  }

  return (
    <article className={cn(
      "rounded-xl border bg-card p-4 transition-colors",
      c.isFormalInstruction ? "border-gold/50 bg-gold/5 shadow-sm" : "border-border",
    )}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar user={author} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold">{author?.name}</span>
              <span className="text-[11px] text-muted-foreground">{author && ROLE_LABELS[author.role]}</span>
              {c.pinned && <Pin className="h-3 w-3 text-gold" />}
              {c.edited && <span className="text-[10px] text-muted-foreground">تم التعديل</span>}
            </div>
            <div className="text-xs text-muted-foreground">{fmtDateTime(c.createdAt)}</div>
          </div>
        </div>
        <Badge variant="outline" className={cn("gap-1", typeColor[c.type])}>
          <Icon className="h-3 w-3" />
          {COMMENT_TYPE_LABELS[c.type]}
        </Badge>
      </header>

      {c.isFormalInstruction && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-foreground">
          <ShieldAlert className="h-4 w-4" /> توجيه رسمي
        </div>
      )}

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{c.body}</p>

      {c.questionStatus && (
        <div className="mt-2 text-xs">
          <Badge variant="outline">حالة الاستفسار: {c.questionStatus === "waiting" ? "بانتظار الرد" : c.questionStatus === "answered" ? "تم الرد" : "تم الحل"}</Badge>
        </div>
      )}

      {needsAck && (
        <div className="mt-3 flex items-center justify-between rounded-md bg-gold/15 p-2">
          <span className="text-xs font-medium">بانتظار تأكيد الاستلام</span>
          <Button size="sm" variant="default" onClick={() => onAck(c.id)}>
            <CheckCheck className="h-4 w-4 me-1" /> تأكيد الاستلام
          </Button>
        </div>
      )}
      {c.acknowledgedByUserId && (
        <div className="mt-2 text-[11px] text-success-foreground">
          <CheckCheck className="inline h-3 w-3 me-1" />
          تم الاستلام بواسطة {acker?.name} — {fmtDateTime(c.acknowledgedAt!)}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => onReply(c.id)} className="text-xs">
          <Reply className="h-3.5 w-3.5 me-1" /> رد
        </Button>
      </div>

      {childrenList.length > 0 && (
        <div className="mt-3 space-y-2 border-r-2 border-border pr-4">
          {childrenList.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/70 bg-background p-3">
              <div className="flex items-center gap-2">
                <UserAvatar user={getUser(r.authorId)} size={24} />
                <span className="text-xs font-semibold">{getUser(r.authorId)?.name}</span>
                <span className="text-[10px] text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
              </div>
              <p className="mt-1.5 text-sm">{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}