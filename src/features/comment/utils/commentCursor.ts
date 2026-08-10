import type { CommentCursor, PostComment } from '../types';

/**
 * 한 번에 받아 오는 **1단 댓글**의 수.
 *
 * 답글은 세지 않는다. 1단 열 개를 받고 **거기 딸린 답글은 함께** 온다 —
 * 그래서 실제로 오는 줄 수는 열 개보다 많을 수 있다. 왜 이렇게 세는지는 아래.
 */
export const COMMENT_PAGE_SIZE = 10;

/** 이 페이지의 1단 댓글만. 답글은 부모를 따라온 것이라 커서 계산에 끼지 않는다. */
export function pickRootComments(comments: ReadonlyArray<PostComment>): PostComment[] {
  return comments.filter(function isRoot(comment: PostComment): boolean {
    return comment.parentId === null;
  });
}

/**
 * 방금 받은 페이지를 보고 다음 커서를 정한다.
 *
 * **1단 댓글을 기준으로 센다.** 평평하게 열 줄씩 끊으면 답글이 부모와 갈라져
 * 다음 페이지로 넘어가는데, 그러면 `buildCommentTree`가 부모 없는 답글을 **1단으로 올려**
 * 그린다(그쪽은 차단 때문에 부모가 사라진 경우를 위해 그렇게 만들어졌다).
 * 대화의 답이 물음처럼 보이게 되므로, 자를 곳은 **실타래 사이**여야 한다.
 *
 * 규칙은 이 저장소의 다른 커서와 같다 — 한 페이지가 다 차지 않았으면 뒤에 남은 것이 없다.
 * TanStack Query의 getNextPageParam은 undefined를 "다음 없음"으로 읽는다.
 */
export function toNextCommentCursor(lastPage: PostComment[]): CommentCursor | undefined {
  const roots = pickRootComments(lastPage);

  if (roots.length < COMMENT_PAGE_SIZE) {
    return undefined;
  }

  const last = roots[roots.length - 1];

  return { createdAt: last.createdAt, id: last.id };
}
