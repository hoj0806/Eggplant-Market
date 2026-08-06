import { toNextPostSearchCursor } from './postSearchCursor';
import { POST_SEARCH_PAGE_SIZE } from '../api/postApi';
import type { PostSummary } from '../types';

jest.mock('../api/postApi', function mockPostApi() {
  // postApi는 supabaseClient를 거쳐 import.meta.env에 닿는다.
  // ts-jest가 CommonJS로 옮기면서 import.meta를 그대로 뱉으므로 실제 모듈은 로드하지 않는다.
  return { POST_SEARCH_PAGE_SIZE: 20 };
});

const BUMPED_AT = '2026-08-02T05:00:00.000Z';

function toPost(id: number, overrides: Partial<PostSummary> = {}): PostSummary {
  return {
    id,
    title: `물건 ${id}`,
    price: 1000,
    status: 'selling',
    thumbnailUrl: null,
    dongName: '서울특별시 성북구 석관동',
    likeCount: 0,
    viewCount: 0,
    bumpedAt: BUMPED_AT,
    distanceM: null,
    ...overrides,
  };
}

/** 마지막 글만 커서에 쓰이므로, 앞의 채움용 글은 기본값으로 둔다. */
function toFullPage(lastPost: PostSummary): PostSummary[] {
  const posts: PostSummary[] = [];

  for (let index = 0; index < POST_SEARCH_PAGE_SIZE - 1; index += 1) {
    posts.push(toPost(index + 1));
  }
  posts.push(lastPost);

  return posts;
}

describe('toNextPostSearchCursor', function toNextPostSearchCursorSuite() {
  it('페이지가 다 차지 않았으면 다음 페이지가 없다', function partialPage() {
    expect(toNextPostSearchCursor([toPost(1)], 'latest')).toBeUndefined();
  });

  it('빈 페이지도 다음이 없는 것으로 본다', function emptyPage() {
    expect(toNextPostSearchCursor([], 'latest')).toBeUndefined();
  });

  it('최신순은 마지막 글의 끌올 시각을 커서로 삼는다', function latestSort() {
    const page = toFullPage(toPost(99, { bumpedAt: '2026-08-01T00:00:00.000Z' }));

    expect(toNextPostSearchCursor(page, 'latest')).toEqual({
      value: '2026-08-01T00:00:00.000Z',
      id: 99,
    });
  });

  it('조회순은 조회수를, 찜순은 찜 수를 커서로 삼는다', function countSorts() {
    const page = toFullPage(toPost(99, { viewCount: 42, likeCount: 7 }));

    expect(toNextPostSearchCursor(page, 'popular')).toEqual({ value: '42', id: 99 });
    expect(toNextPostSearchCursor(page, 'likes')).toEqual({ value: '7', id: 99 });
  });

  it('가격순은 오름·내림 모두 가격을 커서로 삼는다', function priceSorts() {
    const page = toFullPage(toPost(99, { price: 35000 }));

    expect(toNextPostSearchCursor(page, 'price_asc')).toEqual({ value: '35000', id: 99 });
    expect(toNextPostSearchCursor(page, 'price_desc')).toEqual({ value: '35000', id: 99 });
  });

  it('0원·0회도 값이 있는 것으로 본다', function zeroValues() {
    const page = toFullPage(toPost(99, { price: 0, viewCount: 0 }));

    expect(toNextPostSearchCursor(page, 'price_asc')).toEqual({ value: '0', id: 99 });
    expect(toNextPostSearchCursor(page, 'popular')).toEqual({ value: '0', id: 99 });
  });

  it('거리순은 마지막 글까지의 거리를 커서로 삼는다', function distanceSort() {
    const page = toFullPage(toPost(99, { distanceM: 1000.4738368055285 }));

    // 소수점을 잘라내면 안 된다. 서버는 이 문자열을 double precision으로 되돌려
    // 그대로 비교하므로, 값이 조금이라도 어긋나면 경계의 글이 겹치거나 사라진다.
    expect(toNextPostSearchCursor(page, 'distance')).toEqual({
      value: '1000.4738368055285',
      id: 99,
    });
  });

  it('거리를 모르면 다음 페이지를 부르지 않는다', function distanceMissing() {
    // 거리순은 반경 기준에서만 고를 수 있어(0024) 실제로는 오지 않는 경우다.
    // 0으로 갈음하면 서버가 "0m보다 먼 글부터"로 읽어 이미 본 목록을 처음부터 다시 준다.
    const page = toFullPage(toPost(99, { distanceM: null }));

    expect(toNextPostSearchCursor(page, 'distance')).toBeUndefined();
  });

  it('거리 0도 값이 있는 것으로 본다', function distanceZero() {
    // 내 동네에 올라온 글은 대표 좌표가 같아 거리가 0이다. 흔한 값이다.
    const page = toFullPage(toPost(99, { distanceM: 0 }));

    expect(toNextPostSearchCursor(page, 'distance')).toEqual({ value: '0', id: 99 });
  });
});
