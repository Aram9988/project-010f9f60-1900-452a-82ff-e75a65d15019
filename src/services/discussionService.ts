import { comments } from "@/lib/mock/seed";
import type { Comment, CommentType } from "@/lib/types";

export const discussionService = {
  async listForTask(taskId: string): Promise<Comment[]> {
    return comments.filter((c) => c.taskId === taskId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async add(input: { taskId: string; authorId: string; body: string; type: CommentType; parentId?: string; isFormalInstruction?: boolean; }): Promise<Comment> {
    const c: Comment = {
      id: "c" + Date.now(),
      taskId: input.taskId,
      authorId: input.authorId,
      body: input.body,
      type: input.type,
      parentId: input.parentId,
      createdAt: new Date().toISOString(),
      isFormalInstruction: input.isFormalInstruction,
      pinned: input.isFormalInstruction,
      questionStatus: input.type === "question" ? "waiting" : undefined,
    };
    comments.push(c);
    return c;
  },
  async acknowledge(commentId: string, userId: string) {
    const c = comments.find((x) => x.id === commentId); if (!c) return;
    c.acknowledgedByUserId = userId; c.acknowledgedAt = new Date().toISOString();
  },
  async hide(commentId: string) {
    const c = comments.find((x) => x.id === commentId); if (c) c.hidden = true;
  },
};