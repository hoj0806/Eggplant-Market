import { buildCommentTree, countReplies } from './buildCommentTree';
import type { PostComment } from '../types';

function buildComment(id: number, parentId: number | null, createdAt: string): PostComment {
  return {
    id,
    postId: 7,
    parentId,
    content: `댓글 ${id}`,
    createdAt,
    author: { id: `user-${id}`, nickname: `이웃${id}`, avatarUrl: null },
  };
}

describe('buildCommentTree', function buildCommentTreeSuite() {
  it('답글을 부모 밑으로 접는다', function nestCase() {
    const tree = buildCommentTree([
      buildComment(1, null, '2026-08-05T10:00:00Z'),
      buildComment(2, 1, '2026-08-05T10:01:00Z'),
      buildComment(3, null, '2026-08-05T10:02:00Z'),
    ]);

    expect(tree).toHaveLength(2);
    expect(tree[0].comment.id).toBe(1);
    expect(tree[0].replies.map(function toId(reply: PostComment): number {
      return reply.id;
    })).toEqual([2]);
    expect(tree[1].comment.id).toBe(3);
    expect(tree[1].replies).toEqual([]);
  });

  // 지금 질의는 시간순이라 부모가 언제나 먼저 오지만, 순서에 기대면 정렬이 바뀌는 날 깨진다.
  it('답글이 부모보다 먼저 와도 접힌다', function outOfOrderCase() {
    const tree = buildCommentTree([
      buildComment(2, 1, '2026-08-05T10:01:00Z'),
      buildComment(1, null, '2026-08-05T10:00:00Z'),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].comment.id).toBe(1);
    expect(tree[0].replies).toHaveLength(1);
  });

  // 차단하면 그 사람 댓글만 사라진다(0017의 comments_select). 거기 달린 내 답글은 그대로 온다.
  it('부모를 잃은 답글은 버리지 않고 1단으로 올린다', function orphanCase() {
    const tree = buildCommentTree([
      buildComment(2, 99, '2026-08-05T10:01:00Z'),
      buildComment(3, null, '2026-08-05T10:02:00Z'),
    ]);

    expect(tree.map(function toId(node: { comment: PostComment }): number {
      return node.comment.id;
    })).toEqual([3, 2]);
  });

  it('댓글이 없으면 빈 트리다', function emptyCase() {
    expect(buildCommentTree([])).toEqual([]);
  });
});

describe('countReplies', function countRepliesSuite() {
  it('그 댓글에 딸린 답글만 센다', function countCase() {
    const comments = [
      buildComment(1, null, '2026-08-05T10:00:00Z'),
      buildComment(2, 1, '2026-08-05T10:01:00Z'),
      buildComment(3, 1, '2026-08-05T10:02:00Z'),
      buildComment(4, null, '2026-08-05T10:03:00Z'),
      buildComment(5, 4, '2026-08-05T10:04:00Z'),
    ];

    expect(countReplies(comments, 1)).toBe(2);
    expect(countReplies(comments, 4)).toBe(1);
    expect(countReplies(comments, 2)).toBe(0);
  });
});
