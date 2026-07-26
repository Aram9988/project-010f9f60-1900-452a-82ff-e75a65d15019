import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { discussionService } from "@/services/discussionService";
import { getUser } from "@/services/userService";
import { useSession, useAppStore } from "@/lib/store";
import type { Comment, CommentType, User } from "@/lib/types";
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
import { AlertOctagon, Check, CheckCheck, CornerDownLeft, EyeOff, Lock, MessageSquare, Pencil, Pin, Reply, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { hasPermission } from "@/lib/authz";

const typeIcon: Record<CommentType, React.ComponentType<{ className?: string }>> = {
  comment: MessageSquare, instruction: ShieldAlert, question: AlertOctagon,
  update: CheckCheck, revision_request: Reply, internal_note: EyeOff,
};
/**
 * Semantic text colors chosen for legibility on white AND dark surfaces.
 * Uses the token colors directly (not *-foreground, which is intended for
 * solid backgrounds and reads white on light mode).
 */
const typeColor: Record<CommentType, string> = {
  comment: "text-foreground", instruction: "text-gold",
  question: "text-info", update: "text-success",
  revision_request: "text-destructive", internal_note: "text-muted-foreground",
};

type ThreadFilter = "all" | "instructions" | "questions" | "updates" | "attachments" | "unanswered" | "needs_ack";

export function DiscussionThread({ taskId, filter: propFilter = "all", highlightCommentId }: {
  taskId: string; filter?: "all" | "discussion" | "instructions"; highlightCommentId?: string;
}) {
  const qc = useQueryClient();
  const currentUserId = useSession((s) => s.currentUserId);
  const currentUser = getUser(currentUserId);
  const task = useAppStore((s) => s.tasks.find((t) => t.id === taskId));
  const users = useAppStore((s) => s.users);
  const editCommentAction = useAppStore((s) => s.editComment);
  const hideCommentAction = useAppStore((s) => s.hideComment);
  const markAnswered = useAppStore((s) => s.markQuestionAnswered);

  const canComment = !!currentUser && hasPermission(currentUser, "comment") && !task?.archived && task?.status !== "approved";
  const canFormal = !!currentUser && hasPermission(currentUser, "issue_formal_instruction");
  const canAttach = !!currentUser && hasPermission(currentUser, "upload_attachment");
  const canAck = !!currentUser && hasPermission(currentUser, "acknowledge_instruction");
  const canModerate = !!currentUser && (hasPermission(currentUser, "delete_task") || hasPermission(currentUser, "manage_users"));

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => discussionService.listForTask(taskId),
  });

  const [body, setBody] = useState("");
  const [type, setType] = useState<CommentType>("comment");
  const [formal, setFormal] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [filter, setFilter] = useState<ThreadFilter>(propFilter === "instructions" ? "instructions" : "all");
  // simple mention popup
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filtered = useMemo(() => {
    switch (filter) {
      case "instructions": return comments.filter((c) => c.isFormalInstruction);
      case "questions": return comments.filter((c) => c.type === "question");
      case "updates": return comments.filter((c) => c.type === "update");
      case "attachments": return comments.filter((c) => (c.attachments ?? []).length > 0);
      case "unanswered": return comments.filter((c) => c.type === "question" && c.questionStatus !== "answered" && c.questionStatus !== "resolved");
      case "needs_ack": return comments.filter((c) => c.isFormalInstruction && !c.acknowledgedByUserId);
      default: return comments;
    }
  }, [comments, filter]);

  const roots = filtered.filter((c) => !c.parentId);
  const childrenOf = (id: string) => comments.filter((c) => c.parentId === id);

  // scroll to highlighted comment on deep link
  useEffect(() => {
    if (!highlightCommentId) return;
    const el = document.getElementById(`comment-${highlightCommentId}`);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("ring-2","ring-gold"); setTimeout(() => el.classList.remove("ring-2","ring-gold"), 2400); }
  }, [highlightCommentId, comments.length]);

  function handleBodyChange(v: string) {
    setBody(v);
    // detect trailing @token
    const m = v.match(/(?:^|\s)@([\p{L}\d_]*)$/u);
    if (m) { setMentionOpen(true); setMentionQuery(m[1]); }
    else setMentionOpen(false);
  }

  function insertMention(u: User) {
    const v = body.replace(/(?:^|\s)@([\p{L}\d_]*)$/u, (m) => (m.startsWith(" ") ? " " : "") + "@" + u.name.replace(/\s+/g, "_") + " ");
    setBody(v); setMentionOpen(false); setMentionIds((prev) => Array.from(new Set([...prev, u.id])));
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  const mentionCandidates = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.toLowerCase();
    return users.filter((u) => u.active !== false && !u.archived && u.role !== "diwan")
      .filter((u) => !q || u.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [users, mentionOpen, mentionQuery]);

  async function submit() {
    if (!canComment) return;
    if (!body.trim()) return;
    await discussionService.add({
      taskId, authorId: currentUserId, body: body.trim(), type,
      parentId: replyTo ?? undefined,
      isFormalInstruction: canFormal && formal,
      mentions: mentionIds.length ? mentionIds : undefined,
    });
    setBody(""); setReplyTo(null); setFormal(false); setType("comment"); setMentionIds([]);
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
    toast.success("تمت الإضافة");
  }

  async function ack(commentId: string) {
    if (!canAck) return toast.error("لا تملك صلاحية استلام التوجيهات");
    await discussionService.acknowledge(commentId, currentUserId);
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
    toast.success("تم تأكيد الاستلام");
  }
  function edit(c: Comment) {
    const v = window.prompt("تعديل التعليق:", c.body); if (v == null) return;
    editCommentAction(c.id, currentUserId, v.trim());
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
  }
  function hide(c: Comment) {
    if (!confirm("إخفاء هذا التعليق؟")) return;
    hideCommentAction(c.id, currentUserId);
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
  }
  function markQ(c: Comment) {
    markAnswered(c.id, currentUserId);
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
  }

  const isLocked = !canComment;
  const filterBtns: [ThreadFilter, string][] = [
    ["all", "الكل"], ["instructions", "التوجيهات"], ["questions", "الاستفسارات"],
    ["updates", "التحديثات"], ["attachments", "بمرفقات"], ["unanswered", "بلا إجابة"], ["needs_ack", "بانتظار الاستلام"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {filterBtns.map(([k, l]) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)} className="h-7 text-xs">{l}</Button>
        ))}
      </div>

      {roots.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {comments.length === 0 ? "لا توجد رسائل حتى الآن. ابدأ النقاش بكتابة أول تعليق." : "لا توجد رسائل ضمن هذا التصنيف."}
        </div>
      )}
      {roots.map((c) => (
        <CommentItem key={c.id} c={c} childrenList={childrenOf(c.id)}
          onReply={canComment ? setReplyTo : () => toast.error("لا تملك صلاحية التعليق")}
          onAck={ack}
          onEdit={edit} onHide={hide} onMarkAnswered={markQ}
          currentUserId={currentUserId} canModerate={canModerate}
          highlight={highlightCommentId === c.id}
        />
      ))}

      {isLocked ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Lock className="h-3.5 w-3.5" />
          {task?.status === "approved" ? "تم اعتماد التكليف — النقاش مقفل." : task?.archived ? "التكليف مؤرشف — النقاش مقفل." : "لا تملك صلاحية إضافة تعليقات."}
        </div>
      ) : (
      <div className="sticky bottom-0 rounded-xl border border-border bg-card p-3 shadow-sm">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-muted px-2 py-1 text-xs">
            <span>الرد على تعليق سابق</span>
            <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>إلغاء</Button>
          </div>
        )}
        <div className="relative">
          <Textarea ref={textareaRef} value={body} onChange={(e) => handleBodyChange(e.target.value)}
            placeholder="اكتب تعليقك… استخدم @ لذكر شخص" className="min-h-20 resize-none border-0 focus-visible:ring-0 shadow-none p-2" />
          {mentionOpen && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full mb-1 right-0 z-10 w-64 rounded-md border bg-popover shadow-md">
              {mentionCandidates.map((u) => (
                <button key={u.id} type="button" onClick={() => insertMention(u)}
                  className="w-full text-right px-3 py-2 hover:bg-muted text-sm flex flex-col">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[u.role]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
                <Label htmlFor="formal" className="text-xs font-medium cursor-pointer text-gold">توجيه رسمي</Label>
              </div>
            )}
            {canAttach && (
              <span className="text-[11px] text-muted-foreground">💡 لرفع مرفقات استخدم تبويب المرفقات.</span>
            )}
          </div>
          <Button onClick={submit} className="gap-1" disabled={!body.trim()}>
            <CornerDownLeft className="h-4 w-4" />
            إرسال
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

function CommentItem({ c, childrenList, onReply, onAck, onEdit, onHide, onMarkAnswered, currentUserId, canModerate, highlight }: {
  c: Comment; childrenList: Comment[]; onReply: (id: string) => void;
  onAck: (id: string) => void; onEdit: (c: Comment) => void; onHide: (c: Comment) => void;
  onMarkAnswered: (c: Comment) => void;
  currentUserId: string; canModerate: boolean; highlight?: boolean;
}) {
  const author = getUser(c.authorId);
  const acker = c.acknowledgedByUserId ? getUser(c.acknowledgedByUserId) : undefined;
  const Icon = typeIcon[c.type];
  const needsAck = c.isFormalInstruction && !c.acknowledgedByUserId;
  const isAuthor = c.authorId === currentUserId;
  const withinEditWindow = (Date.now() - new Date(c.createdAt).getTime()) < 30 * 60 * 1000;

  if (c.hidden) {
    return (
      <div id={`comment-${c.id}`} className="rounded-lg border border-dashed border-border bg-muted/50 p-3 text-sm text-muted-foreground">
        تم إخفاء هذا التعليق بواسطة المسؤول
      </div>
    );
  }

  return (
    <article id={`comment-${c.id}`} className={cn(
      "rounded-xl border bg-card p-4 transition-colors",
      c.isFormalInstruction ? "border-gold/50 bg-gold/5 shadow-sm" : "border-border",
      highlight && "ring-2 ring-gold",
    )}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar user={author} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold">{author?.name}</span>
              <span className="text-[11px] text-muted-foreground">{author && ROLE_LABELS[author.role]}</span>
              {c.pinned && <Pin className="h-3 w-3 text-gold" />}
              {c.edited && <span className="text-[10px] text-muted-foreground italic" title={c.editedAt ? fmtDateTime(c.editedAt) : ""}>· تم التعديل</span>}
            </div>
            <div className="text-xs text-muted-foreground">{fmtDateTime(c.createdAt)}</div>
          </div>
        </div>
        <Badge variant="outline" className={cn("gap-1 whitespace-nowrap", typeColor[c.type])}>
          <Icon className="h-3 w-3" />
          {COMMENT_TYPE_LABELS[c.type]}
        </Badge>
      </header>

      {c.isFormalInstruction && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold">
          <ShieldAlert className="h-4 w-4" /> توجيه رسمي
        </div>
      )}

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{c.body}</p>

      {c.questionStatus && (
        <div className="mt-2 text-xs flex items-center gap-2">
          <Badge variant="outline" className={c.questionStatus === "waiting" ? "text-info" : "text-success"}>
            حالة الاستفسار: {c.questionStatus === "waiting" ? "بانتظار الرد" : c.questionStatus === "answered" ? "تم الرد" : "تم الحل"}
          </Badge>
          {c.questionStatus === "waiting" && (isAuthor || canModerate) && (
            <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => onMarkAnswered(c)}>
              <Check className="h-3 w-3 me-1" /> اعتبار مُجاباً
            </Button>
          )}
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
        <div className="mt-2 text-[11px] text-success">
          <CheckCheck className="inline h-3 w-3 me-1" />
          تم الاستلام بواسطة {acker?.name} — {fmtDateTime(c.acknowledgedAt!)}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => onReply(c.id)} className="text-xs h-7">
          <Reply className="h-3.5 w-3.5 me-1" /> رد
        </Button>
        {isAuthor && withinEditWindow && (
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => onEdit(c)}>
            <Pencil className="h-3.5 w-3.5 me-1" /> تعديل
          </Button>
        )}
        {canModerate && (
          <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => onHide(c)}>
            <EyeOff className="h-3.5 w-3.5 me-1" /> إخفاء
          </Button>
        )}
      </div>

      {childrenList.length > 0 && (
        <div className="mt-3 space-y-2 border-r-2 border-border pr-4">
          {childrenList.map((r) => (
            <div key={r.id} id={`comment-${r.id}`} className="rounded-lg border border-border/70 bg-background p-3">
              <div className="flex items-center gap-2">
                <UserAvatar user={getUser(r.authorId)} size={24} />
                <span className="text-xs font-semibold">{getUser(r.authorId)?.name}</span>
                <span className="text-[10px] text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
                {r.edited && <span className="text-[10px] text-muted-foreground italic">· تم التعديل</span>}
              </div>
              <p className="mt-1.5 text-sm whitespace-pre-wrap">{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}