/**
 * 댓글 한 건.
 *
 * `parentId`를 들고 있지만 지금은 언제나 null이다. 대댓글은 다음 단계이고(0017),
 * 서버 칸이 이미 있어 여기서도 자리만 지킨다 — 나중에 트리로 접을 때 타입이 바뀌지 않는다.
 */
export type PostComment = {
  id: number;
  postId: number;
  parentId: number | null;
  content: string;
  createdAt: string;
  author: CommentAuthor;
};

/**
 * 댓글을 쓴 사람. `PostSeller`와 모양이 겹치지만 매너온도가 없다 —
 * 댓글 목록은 거래 상대를 고르는 자리가 아니라 읽는 자리다.
 */
export type CommentAuthor = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

export type CommentFieldName = 'content';

export type CommentFieldErrors = Partial<Record<CommentFieldName, string>>;
