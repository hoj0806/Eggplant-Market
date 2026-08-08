import type { CommentTreeNode, PostComment } from '../types';

/**
 * 평평한 댓글 배열을 2단 트리로 접는다.
 *
 * 서버는 한 글의 댓글을 시간순 한 줄로 준다(0017의 `comments_post_created_idx`). 트리를
 * 질의에서 만들지 않는 이유는 재귀 CTE를 쓸 만큼 깊지 않아서다 — 깊이가 2로 정해져 있으면
 * 화면에서 한 번 훑는 것이 싸고, 캐시에 이어 붙이는 일(useCreateCommentMutation)도
 * 평평한 배열 그대로 둘 수 있다.
 *
 * **2단까지만 만든다.** 답글에는 답글 버튼을 두지 않는다. 서버의 `parent_id`는 깊이를
 * 묻지 않으므로 3단도 넣을 수는 있지만, 0018의 `notify_post_commented`가 알리는 상대는
 * **부모 댓글 작성자 한 사람**이다. 깊이를 열어 두고 답글을 루트로 접어 붙이면(흔한 방식)
 * 알림은 루트 작성자에게 가고 정작 답을 받은 사람은 모르게 된다 —
 * 화면과 알림이 다른 곳을 가리키게 된다. 2단으로 묶어 두면 둘이 언제나 같다.
 *
 * 부모를 잃은 답글은 **버리지 않고 1단으로 올린다.** 차단하면 그 사람 댓글만 사라지는데
 * (0017의 `comments_select`), 거기 달린 내 답글은 그대로 온다. 버리면 목록에서 사라진
 * 채로 남아 지울 수도 없고, 화면의 "댓글 n"과 실제 줄 수도 어긋난다. 맥락 없는 한 줄이
 * 되기는 하지만 있는 것을 안 보이게 하는 편보다 낫다.
 *
 * 순서는 양쪽 다 오래된 것이 위다. 1단은 받은 순서 그대로고(질의가 이미 정렬해 왔다),
 * 답글도 부모 밑에서 시간순이다 — 물음이 답보다 먼저 보여야 대화로 읽힌다.
 */
export function buildCommentTree(comments: PostComment[]): CommentTreeNode[] {
  const nodeById = new Map<number, CommentTreeNode>();
  const roots: CommentTreeNode[] = [];

  // 1단을 먼저 전부 세운다. 두 번 훑는 이유는 답글이 부모보다 앞에 올 수 있어서다 —
  // 지금 질의는 시간순이라 그럴 일이 없지만, 순서에 기대면 정렬이 바뀌는 날 조용히 깨진다.
  comments.forEach(function collectRoot(comment: PostComment): void {
    if (comment.parentId !== null) {
      return;
    }
    const node: CommentTreeNode = { comment, replies: [] };
    nodeById.set(comment.id, node);
    roots.push(node);
  });

  comments.forEach(function attachReply(comment: PostComment): void {
    if (comment.parentId === null) {
      return;
    }

    const parent = nodeById.get(comment.parentId);
    if (parent === undefined) {
      // 부모가 안 보인다(차단됐거나, 3단 답글이 SQL로 직접 들어갔거나).
      roots.push({ comment, replies: [] });
      return;
    }

    parent.replies.push(comment);
  });

  return roots;
}

/**
 * 이 댓글을 지우면 함께 사라지는 답글 수.
 *
 * `comments.parent_id`의 FK가 `on delete cascade`라 부모를 지우면 답글도 함께 지워진다.
 * 지우는 사람이 그것을 알고 눌러야 해서 확인 문구에 숫자를 얹는다.
 *
 * 캐시에서 답글을 함께 걷어내는 쪽(useDeleteCommentMutation)도 같은 규칙을 쓴다.
 */
export function countReplies(comments: PostComment[], commentId: number): number {
  return comments.filter(function isReplyOf(comment: PostComment): boolean {
    return comment.parentId === commentId;
  }).length;
}
