import { COMMENT_PAGE_SIZE, pickRootComments, toNextCommentCursor } from './commentCursor';
import type { PostComment } from '../types';

function makeComment(id: number, parentId: number | null = null): PostComment {
  return {
    id,
    postId: 7,
    parentId,
    content: `댓글 ${id}`,
    createdAt: `2026-08-10T00:00:${String(id).padStart(2, '0')}.000Z`,
    updatedAt: `2026-08-10T00:00:${String(id).padStart(2, '0')}.000Z`,
    isSecret: false,
    author: { id: 'author-1', nickname: '가지팔이', avatarUrl: null },
  };
}

/** 1단 `count`개 + 각 1단에 답글 하나씩. 실제 페이지가 오는 모양이다. */
function makePage(count: number, withReplies = false): PostComment[] {
  const roots = Array.from({ length: count }, function toRoot(_unused, index): PostComment {
    return makeComment(index + 1);
  });

  if (!withReplies) {
    return roots;
  }

  return [
    ...roots,
    ...roots.map(function toReply(root: PostComment): PostComment {
      return makeComment(root.id + 100, root.id);
    }),
  ];
}

describe('pickRootComments', function pickRootSuite() {
  it('답글을 걸러낸다', function filtersRepliesCase() {
    const page = makePage(2, true);

    expect(pickRootComments(page).map(function toId(c: PostComment) {
      return c.id;
    })).toEqual([1, 2]);
  });
});

describe('toNextCommentCursor', function nextCursorSuite() {
  /**
   * **이 스위트의 요지다.** 페이지를 1단 기준으로 세지 않으면, 답글이 섞여 열 줄을 채운
   * 순간 "다음 없음"으로 읽혀 뒤에 있는 1단 댓글이 영영 안 나온다.
   */
  it('답글이 섞여 열 줄이 넘어도 1단이 덜 찼으면 끝이다', function repliesDoNotCountCase() {
    // 1단 3개 + 답글 3개 = 여섯 줄. 1단 기준으로는 아직 한 페이지도 못 채웠다.
    const page = makePage(3, true);

    expect(page).toHaveLength(6);
    expect(toNextCommentCursor(page)).toBeUndefined();
  });

  it('1단이 꽉 차면 마지막 1단을 커서로 준다', function fullPageCase() {
    const page = makePage(COMMENT_PAGE_SIZE, true);
    const cursor = toNextCommentCursor(page);

    expect(cursor).not.toBeUndefined();
    // 답글(id 100번대)이 아니라 마지막 **1단**이어야 한다.
    expect(cursor?.id).toBe(COMMENT_PAGE_SIZE);
  });

  it('빈 페이지는 끝이다', function emptyCase() {
    expect(toNextCommentCursor([])).toBeUndefined();
  });

  it('한 페이지에 열 개를 받는다', function pageSizeCase() {
    // 사용자가 정한 수다. 바꾸려면 여기부터 바꾼다.
    expect(COMMENT_PAGE_SIZE).toBe(10);
  });
});
