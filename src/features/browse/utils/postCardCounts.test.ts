import { toPostCountsText } from './postCardCounts';
import type { PostSummary } from '../../post/types';

function toPost(overrides: Partial<PostSummary> = {}): PostSummary {
  return {
    id: 1,
    title: '가죽 소파',
    price: 50000,
    status: 'selling',
    thumbnailUrl: null,
    dongName: '서울특별시 성북구 석관동',
    likeCount: 0,
    viewCount: 0,
    commentCount: 0,
    bumpedAt: '2026-08-06T01:00:00.000Z',
    distanceM: null,
    ...overrides,
  };
}

describe('toPostCountsText', function toPostCountsTextSuite() {
  it('셀 것이 하나도 없으면 줄 자체를 만들지 않는다', function nothingToCount() {
    expect(toPostCountsText(toPost())).toBeNull();
  });

  it('0인 것은 빼고 적는다', function skipsZeros() {
    // 셋이 되면서 "찜 0 · 조회 3 · 댓글 0"처럼 없는 것이 있는 것보다 길어졌다.
    expect(toPostCountsText(toPost({ viewCount: 3 }))).toBe('조회 3');
    expect(toPostCountsText(toPost({ commentCount: 2 }))).toBe('댓글 2');
    expect(toPostCountsText(toPost({ likeCount: 1 }))).toBe('찜 1');
  });

  it('찜 · 조회 · 댓글 순으로 적는다', function keepsOrder() {
    // 앞의 둘은 지금까지의 순서 그대로다. 익숙한 자리가 움직이면 같은 카드가 달라 보인다.
    expect(toPostCountsText(toPost({ likeCount: 1, viewCount: 2, commentCount: 3 }))).toBe(
      '찜 1 · 조회 2 · 댓글 3',
    );
  });

  it('가운데가 비면 앞뒤를 곧바로 잇는다', function joinsAroundGaps() {
    // "찜 1 ·  · 댓글 3"처럼 구분점이 남으면 안 된다.
    expect(toPostCountsText(toPost({ likeCount: 1, commentCount: 3 }))).toBe('찜 1 · 댓글 3');
  });
});
