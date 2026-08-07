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
  /**
   * 고친 시각. 내용이 실제로 달라질 때만 오른다(0020).
   * 안 고쳤으면 `createdAt`과 같다 — `isEdited`가 그 비교를 한다.
   */
  updatedAt: string;
  /**
   * 비밀 댓글인가. 참이면 게시물 판매자와 이 실타래를 연 사람만 읽는다(0033).
   *
   * 목록에 이 값이 참인 줄이 와 있다는 것은 **볼 자격이 있다는 뜻**이다 — 거르는 일은
   * `comments_select`가 이미 했다. 화면은 "비밀" 표를 붙일지만 판단한다.
   *
   * 답글에는 부모 값이 그대로 실려 온다. 서버가 받아 적으므로(0033의 `inherit_comment_secret`)
   * 화면이 답글의 공개 범위를 고를 일이 없다.
   */
  isSecret: boolean;
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
