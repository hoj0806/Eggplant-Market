import type { InfiniteData } from '@tanstack/react-query';
import { withAppendedComment, withoutComment, withUpdatedComment } from './commentCache';
import { buildCommentTree } from './buildCommentTree';
import type { PostComment } from '../types';

function makeComment(id: number, parentId: number | null = null): PostComment {
  return {
    id,
    postId: 7,
    parentId,
    content: `댓글 ${id}`,
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    isSecret: false,
    author: { id: 'author-1', nickname: '가지팔이', avatarUrl: null },
  };
}

function makeCache(pages: PostComment[][]): InfiniteData<PostComment[]> {
  return {
    pages,
    pageParams: pages.map(function toParam() {
      return null;
    }),
  };
}

describe('withAppendedComment', function appendSuite() {
  it('마지막 페이지 끝에 붙인다', function appendsToLastCase() {
    const cache = makeCache([[makeComment(1)], [makeComment(2)]]);

    const next = withAppendedComment(cache, makeComment(3));

    // 댓글은 오래된 것이 위라 방금 쓴 것이 맨 아래다.
    expect(next?.pages[1].map(function toId(c: PostComment) {
      return c.id;
    })).toEqual([2, 3]);
    expect(next?.pages[0]).toHaveLength(1);
  });

  /**
   * 목록을 한 번도 안 받아 온 상태에서 배열을 새로 만들면 "방금 쓴 댓글 하나만 있는 목록"이
   * 되고, 그것이 전부인 줄 알게 된다. 0017이 정한 규칙을 페이징 뒤에도 지킨다.
   */
  it('캐시가 없으면 아무것도 하지 않는다', function noCacheCase() {
    expect(withAppendedComment(undefined, makeComment(1))).toBeUndefined();
  });

  it('페이지가 하나도 없으면 만들지 않는다', function noPagesCase() {
    const empty = makeCache([]);

    expect(withAppendedComment(empty, makeComment(1))?.pages).toEqual([]);
  });
});

describe('withUpdatedComment', function updateSuite() {
  it('나중 페이지에 있어도 찾아 바꾼다', function laterPageCase() {
    const cache = makeCache([[makeComment(1)], [makeComment(2)]]);
    const edited = { ...makeComment(2), content: '고쳤어요' };

    expect(withUpdatedComment(cache, edited)?.pages[1][0].content).toBe('고쳤어요');
  });
});

describe('withoutComment', function removeSuite() {
  /**
   * **이 테스트가 지키는 것**: 부모만 걷어내면 남은 답글이 부모를 잃고,
   * `buildCommentTree`가 그것을 1단으로 올려 그린다 — 지워진 대화가 맥락 없이 떠오른다.
   * 0017이 한 번 겪고 고친 자리라 페이징을 얹으면서도 그대로 지킨다.
   */
  it('지운 댓글과 그 답글을 함께 뺀다', function removesRepliesCase() {
    const cache = makeCache([[makeComment(1), makeComment(11, 1), makeComment(2)]]);

    const next = withoutComment(cache, 1);

    expect(next?.pages[0].map(function toId(c: PostComment) {
      return c.id;
    })).toEqual([2]);
  });

  it('부모를 지운 뒤 트리에 떠오르는 줄이 없다', function noOrphanRiseCase() {
    const cache = makeCache([[makeComment(1), makeComment(11, 1)]]);

    const tree = buildCommentTree(withoutComment(cache, 1)?.pages.flat() ?? []);

    expect(tree).toEqual([]);
  });

  it('답글이 다른 페이지에 있어도 뺀다', function acrossPagesCase() {
    const cache = makeCache([[makeComment(1)], [makeComment(11, 1)]]);

    expect(withoutComment(cache, 1)?.pages.flat()).toEqual([]);
  });

  // 페이지 개수가 줄면 getNextPageParam이 보는 마지막 페이지가 달라진다.
  it('페이지가 통째로 비어도 페이지 자체는 남긴다', function keepsEmptyPageCase() {
    const cache = makeCache([[makeComment(1)], [makeComment(2)]]);

    const next = withoutComment(cache, 2);

    expect(next?.pages).toHaveLength(2);
    expect(next?.pageParams).toHaveLength(2);
  });
});
