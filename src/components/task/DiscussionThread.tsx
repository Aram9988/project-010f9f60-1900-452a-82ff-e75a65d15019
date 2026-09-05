import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { discussionService } from "@/services/discussionService";
import { taskService } from "@/services/taskService";
import { getUser } from "@/services/userService";
import { useSession, useAppStore } from "@/lib/store";
import type { Attachment, Comment, CommentType, TaskStatus, User } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AttachmentPicker } from "@/components/task/AttachmentPicker";
import { cn } from "@/lib/utils";
import { CheckCheck, CornerDownLeft, Lock, MessageSquare, Paperclip, Reply, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { hasPermission } from "@/lib/authz";

type SimpleType = "comment" | "update" | "question";
type SimpleFilter = "all" | "updates" | "questions" | "instructions";

const typeLabel: Record<SimpleType, string> = {
  comment: "تعليق",
  update: "تحديث",
  question: "استفسار",
};

export function DiscussionThread({ taskId, highlightCommentId }: {
  taskId: string;
  filter?: "all" | "discussion" | "instructions";
  highlightCommentId?: string;
}) {
  const qc = useQueryClient();
  const currentUserId = useSession((s) => s.currentUserId);
  const currentUser = getUser(currentUserId);
  const task = useAppStore((s) => s.tasks.find((t) => t.id === taskId));
  const users = useAppStore((s) => s.users);
  const markAnswered = useAppStore((s) => s.markQuestionAnswered);

  const canComment = !!currentUser && hasPermission(currentUser, "comment") && !task?.archived && task?.status !== "approved";
  const canFormal = !!currentUser && hasPermission(currentUser, "issue_formal_instruction");
  const canAttach = !!currentUser && hasPermission(currentUser, "upload_attachment");
  const canAck = !!currentUser && hasPermission(currentUser, "acknowledge_instruction");
  const canUpdateTask = !!currentUser && hasPermission(currentUser, "update_task");

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => discussionService.listForTask(taskId),
  });

  const [body, setBody] = useState("");
  const [type, setType] = useState<SimpleType>("comment");
  const [formal, setFormal] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [filter, setFilter] = useState<SimpleFilter>("all");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [newStatus, setNewStatus] = useState<TaskStatus | "">("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filtered = useMemo(() => {
    if (filter === "updates") return comments.filter((c) => c.type === "update");
    if (filter === "questions") return comments.filter((c) => c.type === "question");
    if (filter === "instructions") return comments.filter((c) => c.isFormalInstruction);
    return comments;
  }, [comments, filter]);

  const roots = filtered.filter((c) => !c.parentId);
  const childrenOf = (id: string) => comments.filter((c) => c.parentId === id);

  useEffect(() => {
    if (!highlightCommentId) return;
    const el = document.getElementById(`comment-${highlightCommentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-gold");
    const timer = setTimeout(() => el.classList.remove("ring-2", "ring-gold"), 2400);
    return () => clearTimeout(timer);
  }, [highlightCommentId, comments.length]);

  function handleBodyChange(v: string) {
    setBody(v);
    const m = v.match(/(?:^|\s)@([\p{L}\d_]*)$/u);
    if (m) {
      setMentionOpen(true);
      setMentionQuery(m[1]);
    } else {
      setMentionOpen(false);
    }
  }

  function insertMention(u: User) {
    setBody((v) => v.replace(/(?:^|\s)@([\p{L}\d_]*)$/u, (m) => (m.startsWith(" ") ? " " : "") + "@" + u.name.replace(/\s+/g, "_") + " "));
    setMentionIds((prev) => Array.from(new Set([...prev, u.id])));
    setMentionOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  const mentionCandidates = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.toLowerCase();
    return users
      .filter((u) => u.active !== false && !u.archived && u.role !== "diwan")
      .filter((u) => !q || u.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [users, mentionOpen, mentionQuery]);

  async function submit() {
    if (!canComment || !body.trim()) return;

    const commentType: CommentType = formal ? "instruction" : type;
    await discussionService.add({
      taskId,
      authorId: currentUserId,
      body: body.trim(),
      type: commentType,
      parentId: replyTo ?? undefined,
      isFormalInstruction: canFormal && formal,
      mentions: mentionIds.length ? mentionIds : undefined,
      attachments: attachments.length ? attachments : undefined,
    });

    if (type === "update" && newStatus && canUpdateTask) {
      await taskService.updateStatus(taskId, newStatus, currentUserId);
    }

    setBody("");
    setType("comment");
    setFormal(false);
    setReplyTo(null);
    setAttachments([]);
    setShowAttachments(false);
    setNewStatus("");
    setMentionIds([]);
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
    qc.invalidateQueries({ queryKey: ["activity", taskId] });
    toast.success("تم حفظ المتابعة");
  }

  async function acknowledge(commentId: string) {
    if (!canAck) return toast.error("لا تملك صلاحية استلام التوجيه");
    await discussionService.acknowledge(commentId, currentUserId);
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
    toast.success("تم تأكيد استلام التوجيه");
  }

  function resolveQuestion(commentId: string) {
    markAnswered(commentId, currentUserId);
    qc.invalidateQueries({ queryKey: ["comments", taskId] });
  }

  const locked = !canComment;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={filter} onValueChange={(v) => setFilter(v as SimpleFilter)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المتابعة</SelectItem>
            <SelectItem value="updates">التحديثات</SelectItem>
            <SelectItem value="questions">الاستفسارات</SelectItem>
            <SelectItem value="instructions">التوجيهات الرسمية</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {roots.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          لا توجد متابعة حتى الآن.
        </div>
      ) : (
        <div className="space-y-3">
          {roots.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={childrenOf(c.id)}
              currentUserId={currentUserId}
              canReply={canComment}
              canAck={canAck}
              onReply={setReplyTo}
              onAck={acknowledge}
              onResolve={resolveQuestion}
              highlight={highlightCommentId === c.id}
            />
          ))}
        </div>
      )}

      {locked ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground">
          <Lock className="h-4 w-4" />
          {task?.status === "approved" ? "تم اعتماد التكليف — المتابعة مقفلة." : task?.archived ? "التكليف مؤرشف — المتابعة مقفلة." : "لا تملك صلاحية الإضافة."}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          {replyTo && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
              <span>أنت ترد على رسالة سابقة</span>
              <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>إلغاء</Button>
            </div>
          )}

          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => handleBodyChange(e.target.value)}
              placeholder="اكتب متابعة أو تحديثاً… ويمكنك استخدام @ لذكر شخص"
              className="min-h-24 resize-none"
            />
            {mentionOpen && mentionCandidates.length > 0 && (
              <div className="absolute bottom-full right-0 z-20 mb-1 w-64 rounded-lg border bg-popover shadow-lg">
                {mentionCandidates.map((u) => (
                  <button key={u.id} type="button" onClick={() => insertMention(u)} className="block w-full px-3 py-2 text-right hover:bg-muted">
                    <div className="text-sm font-medium">{u.name}</div>
                    <div className="text-[10px] text-muted-foreground">{ROLE_LABELS[u.role]}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select value={type} onValueChange={(v) => { setType(v as SimpleType); if (v !== "update") setNewStatus(""); }} disabled={formal}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(typeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>

            {type === "update" && canUpdateTask && !formal && (
              <Select value={newStatus || "__none"} onValueChange={(v) => setNewStatus(v === "__none" ? "" : v as TaskStatus)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="الحالة الآن" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">بدون تغيير الحالة</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="waiting_info">بانتظار المعلومات</SelectItem>
                  <SelectItem value="blocked">متوقف / عالق</SelectItem>
                </SelectContent>
              </Select>
            )}

            {canFormal && (
              <div className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2">
                <Switch id="formal-instruction" checked={formal} onCheckedChange={setFormal} />
                <Label htmlFor="formal-instruction" className="cursor-pointer text-xs font-medium text-gold">توجيه رسمي</Label>
              </div>
            )}

            {canAttach && (
              <Button type="button" variant={showAttachments ? "secondary" : "outline"} size="sm" onClick={() => setShowAttachments((v) => !v)}>
                <Paperclip className="h-4 w-4 me-1" /> إرفاق ملف
                {attachments.length > 0 && ` (${attachments.length})`}
              </Button>
            )}

            <Button onClick={submit} disabled={!body.trim()} className="ms-auto">
              <CornerDownLeft className="h-4 w-4 me-1" /> إرسال
            </Button>
          </div>

          {showAttachments && canAttach && (
            <div className="mt-3 rounded-xl bg-muted/30 p-3">
              <AttachmentPicker onChange={setAttachments} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  replies,
  currentUserId,
  canReply,
  canAck,
  onReply,
  onAck,
  onResolve,
  highlight,
}: {
  comment: Comment;
  replies: Comment[];
  currentUserId: string;
  canReply: boolean;
  canAck: boolean;
  onReply: (id: string) => void;
  onAck: (id: string) => void;
  onResolve: (id: string) => void;
  highlight?: boolean;
}) {
  if (comment.hidden) {
    return <div id={`comment-${comment.id}`} className="rounded-xl border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">تم إخفاء هذا التعليق بواسطة المسؤول</div>;
  }

  const author = getUser(comment.authorId);
  const formal = !!comment.isFormalInstruction;
  const needsAck = formal && !comment.acknowledgedByUserId;
  const label = formal ? "توجيه رسمي" : comment.type === "update" ? "تحديث" : comment.type === "question" ? "استفسار" : "تعليق";

  return (
    <article id={`comment-${comment.id}`} className={cn("rounded-xl border bg-card p-4", formal && "border-gold/50 bg-gold/5", highlight && "ring-2 ring-gold") }>
      <div className="flex items-start gap-3">
        <UserAvatar user={author} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{author?.name ?? "مستخدم غير متاح"}</span>
            <Badge variant={formal ? "default" : "outline"} className={formal ? "bg-gold text-gold-foreground" : ""}>
              {formal ? <ShieldAlert className="h-3 w-3 me-1" /> : <MessageSquare className="h-3 w-3 me-1" />}
              {label}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{fmtDateTime(comment.createdAt)}</span>
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{comment.body}</p>

          {(comment.attachments ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(comment.attachments ?? []).map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3" /> {a.name}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canReply && <Button size="sm" variant="ghost" onClick={() => onReply(comment.id)}><Reply className="h-3.5 w-3.5 me-1" /> رد</Button>}
            {needsAck && canAck && <Button size="sm" variant="outline" onClick={() => onAck(comment.id)}><CheckCheck className="h-3.5 w-3.5 me-1" /> تأكيد الاستلام</Button>}
            {comment.type === "question" && comment.questionStatus !== "resolved" && currentUserId !== comment.authorId && (
              <Button size="sm" variant="ghost" onClick={() => onResolve(comment.id)}>تم الرد / الحل</Button>
            )}
          </div>

          {replies.length > 0 && (
            <div className="mt-4 space-y-2 border-r-2 border-muted pr-3">
              {replies.map((r) => (
                <div key={r.id} id={`comment-${r.id}`} className="rounded-lg bg-muted/35 p-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar user={getUser(r.authorId)} size={26} />
                    <span className="text-xs font-semibold">{getUser(r.authorId)?.name ?? "مستخدم غير متاح"}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{r.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
