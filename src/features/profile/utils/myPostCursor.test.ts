import { toNextMyPostCursor } from './myPostCursor';
import { MY_POSTS_PAGE_SIZE } from '../api/myPostsApi';
import type { MyPostSummary } from '../types';

jest.mock('../api/myPostsApi', function mockMyPostsApi() {
  // myPostsApi는 supabaseClient를 거쳐 import.meta.env에 닿는다.
  // ts-jest가 CommonJS로 옮기면서 import.meta를 그대로 뱉으므로 실제 모듈은 로드하지 않는다.
  // (postSearchCursor.test.ts와 같은 이유다)
  return { MY_POSTS_PAGE_SIZE: 20 };
});

function createPost(id: number, sortAt: string): MyPostSummary {
  return {
    id,
    title: `물건 ${id}`,
    price: 10000,
    status: 'selling',
    thumbnailUrl: null,
    dongName: '서울특별시 강북구 수유동',
    likeCount: 0,
    viewCount: 0,
    bumpedAt: sortAt,
    sortAt,
  };
}

function createFullPage(): MyPostSummary[] {
  return Array.from({ length: MY_POSTS_PAGE_SIZE }, function toPost(_unused, index) {
    return createPost(index + 1, `2026-08-0${(index % 9) + 1}T00:00:00.000Z`);
  });
}

describe('toNextMyPostCursor', function myPostCursorSuite() {
  it('페이지가 가득 찼으면 마지막 행을 다음 커서로 삼는다', function fullPageCase() {
    const page = createFullPage();
    const last = page[page.length - 1];

    expect(toNextMyPostCursor(page)).toEqual({ sortAt: last.sortAt, id: last.id });
  });

  it('페이지가 덜 찼으면 뒤에 남은 것이 없다', function partialPageCase() {
    const page = [createPost(1, '2026-08-01T00:00:00.000Z')];

    expect(toNextMyPostCursor(page)).toBeUndefined();
  });

  it('빈 페이지에서 멈춘다', function emptyPageCase() {
    expect(toNextMyPostCursor([])).toBeUndefined();
  });

  it('커서는 bumpedAt이 아니라 sortAt을 쓴다 — 목록마다 정렬 기준이 다르다', function usesSortAt() {
    const page = createFullPage();
    page[page.length - 1] = {
      ...page[page.length - 1],
      bumpedAt: '2020-01-01T00:00:00.000Z',
      sortAt: '2026-08-03T12:00:00.000Z',
    };

    expect(toNextMyPostCursor(page)?.sortAt).toBe('2026-08-03T12:00:00.000Z');
  });
});
