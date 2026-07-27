import type { DanmakuComment } from '../types';
const key = (slotId: string) => `la_on_box_comments_${slotId}`;
export const commentService = { list(slotId: string): DanmakuComment[] { try { return (JSON.parse(localStorage.getItem(key(slotId)) || '[]') as DanmakuComment[]).filter(c => c.status === 'approved'); } catch { return []; } }, send(comment: DanmakuComment) { const entries = this.list(comment.slotId); localStorage.setItem(key(comment.slotId), JSON.stringify([...entries, comment])); return comment; } };
