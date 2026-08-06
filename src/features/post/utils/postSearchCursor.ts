import { POST_SEARCH_PAGE_SIZE, type PostSearchCursor } from '../api/postApi';
import type { PostSortOption } from '../../browse/types';
import type { PostSummary } from '../types';

/**
 * 커서에 담을 정렬값을 고른다.
 *
 * 서버는 이 값을 정렬 컬럼과 그대로 비교하므로(0011), **정렬 기준과 짝이 어긋나면 안 된다** —
 * 찜순으로 보면서 bumped_at을 보내면 like_count와 시각 문자열을 견주다 캐스팅에서 죽는다.
 * 그래서 정렬 기준을 받아 여기서 한 번에 정한다.
 */
function toCursorValue(post: PostSummary, sort: PostSortOption): string | null {
  switch (sort) {
    case 'popular':
      return String(post.viewCount);
    case 'likes':
      return String(post.likeCount);
    case 'price_asc':
    case 'price_desc':
      return String(post.price);
    case 'distance':
      // 거리순은 반경 기준에서만 고를 수 있어(0024) 여기가 null일 수 없다.
      // 그래도 0으로 갈음하지 않는다 — 서버는 그것을 "0m보다 먼 글부터"로 읽어
      // 이미 본 목록을 처음부터 다시 준다. 다음 페이지를 포기하는 편이 낫다.
      return post.distanceM === null ? null : String(post.distanceM);
    case 'latest':
      return post.bumpedAt;
  }
}

/**
 * 방금 받은 페이지를 보고 다음 커서를 정한다.
 *
 * 한 페이지가 다 차지 않았으면 뒤에 남은 글이 없다는 뜻이라 여기서 멈춘다.
 * 마지막 페이지가 딱 떨어지는 경우(예: 총 40건)에는 한 번 더 요청해 빈 페이지를 받고 끝난다 —
 * "총 몇 건인지" 세는 쿼리를 매번 더 보내는 것보다 이 헛걸음 한 번이 싸다.
 *
 * TanStack Query의 getNextPageParam은 undefined를 "다음 없음"으로 읽는다.
 */
export function toNextPostSearchCursor(
  lastPage: PostSummary[],
  sort: PostSortOption,
): PostSearchCursor | undefined {
  if (lastPage.length < POST_SEARCH_PAGE_SIZE) {
    return undefined;
  }

  const lastPost = lastPage[lastPage.length - 1];
  const value = toCursorValue(lastPost, sort);

  // 정렬값이 없으면 다음 페이지의 시작점을 가리킬 수 없다. 여기서 멈추는 것이 유일한 정답이다.
  if (value === null) {
    return undefined;
  }

  return { value, id: lastPost.id };
}
