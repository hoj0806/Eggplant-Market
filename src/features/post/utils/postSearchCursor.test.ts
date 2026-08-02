import { toNextPostSearchCursor } from './postSearchCursor';
import { POST_SEARCH_PAGE_SIZE } from '../api/postApi';
import type { PostSummary } from '../types';

jest.mock('../api/postApi', function mockPostApi() {
  // postApi는 supabaseClient를 거쳐 import.meta.env에 닿는다.
  // ts-jest가 CommonJS로 옮기면서 import.meta를 그대로 뱉으므로 실제 모듈은 로드하지 않는다.
  return { POST_SEARCH_PAGE_SIZE: 20 };
});

function toPost(id: number, bumpedAt: string): PostSummary {
  return {
    id,
    title: `물건 ${id}`,
    price: 1000,
    status: 'selling',
    thumbnailUrl: null,
    dongName: '서울특별시 성북구 석관동',
    likeCount: 0,
    viewCount: 0,
    bumpedAt,
  };
}

function toFullPage(): PostSummary[] {
  const posts: PostSummary[] = [];

  for (let index = 0; index < POST_SEARCH_PAGE_SIZE; index += 1) {
    posts.push(toPost(index + 1, '2026-08-02T05:00:00.000Z'));
  }

  return posts;
}

describe('toNextPostSearchCursor', function toNextPostSearchCursorSuite() {
  it('페이지가 다 차지 않았으면 다음 페이지가 없다', function partialPage() {
    expect(toNextPostSearchCursor([toPost(1, '2026-08-02T05:00:00.000Z')])).toBeUndefined();
  });

  it('빈 페이지도 다음이 없는 것으로 본다', function emptyPage() {
    expect(toNextPostSearchCursor([])).toBeUndefined();
  });

  it('페이지가 가득 찼으면 마지막 글을 커서로 삼는다', function fullPage() {
    const page = toFullPage();

    expect(toNextPostSearchCursor(page)).toEqual({
      bumpedAt: '2026-08-02T05:00:00.000Z',
      id: POST_SEARCH_PAGE_SIZE,
    });
  });
});
