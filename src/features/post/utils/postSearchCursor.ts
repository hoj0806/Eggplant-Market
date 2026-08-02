import { POST_SEARCH_PAGE_SIZE, type PostSearchCursor } from '../api/postApi';
import type { PostSummary } from '../types';

/**
 * 방금 받은 페이지를 보고 다음 커서를 정한다.
 *
 * 한 페이지가 다 차지 않았으면 뒤에 남은 글이 없다는 뜻이라 여기서 멈춘다.
 * 마지막 페이지가 딱 떨어지는 경우(예: 총 40건)에는 한 번 더 요청해 빈 페이지를 받고 끝난다 —
 * "총 몇 건인지" 세는 쿼리를 매번 더 보내는 것보다 이 헛걸음 한 번이 싸다.
 *
 * TanStack Query의 getNextPageParam은 undefined를 "다음 없음"으로 읽는다.
 */
export function toNextPostSearchCursor(lastPage: PostSummary[]): PostSearchCursor | undefined {
  if (lastPage.length < POST_SEARCH_PAGE_SIZE) {
    return undefined;
  }

  const lastPost = lastPage[lastPage.length - 1];

  return { bumpedAt: lastPost.bumpedAt, id: lastPost.id };
}
