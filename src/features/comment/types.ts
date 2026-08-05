/**
 * 댓글 한 건.
 *
 * `parentId`가 있으면 답글이다. 서버는 깊이를 묻지 않지만 화면은 2단까지만 만든다
 * (답글에는 답글 버튼을 두지 않는다) — `buildCommentTree`의 주석을 보라.
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
 * 목록을 그리기 위한 모양. 서버에서 오는 것은 평평한 배열이고(0017의 인덱스가 그 순서다),
 * 트리는 화면에서 접는다 — `buildCommentTree`.
 *
 * `replies`는 1단 댓글에만 찬다. 답글의 `replies`는 언제나 빈 배열이다.
 */
export type CommentTreeNode = {
  comment: PostComment;
  replies: PostComment[];
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
