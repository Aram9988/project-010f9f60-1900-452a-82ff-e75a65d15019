import { useAppStore } from "@/lib/store";
import type { Comment, CommentType, Attachment } from "@/lib/types";
export const discussionService = {
  async listForTask(taskId: string): Promise<Comment[]> {
    return useAppStore.getState().comments
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async add(input: { taskId: string; authorId: string; body: string; type: CommentType; parentId?: string; isFormalInstruction?: boolean; mentions?: string[]; attachments?: Attachment[] }): Promise<Comment> {
    return useAppStore.getState().addComment(input);
  },
  async acknowledge(commentId: string, userId: string) {
    useAppStore.getState().acknowledgeInstruction(commentId, userId);
  },
  async hide(commentId: string, actorId: string) {
    useAppStore.getState().hideComment(commentId, actorId);
  },
};
