import { REVIEWS_PAGE_SIZE } from '../api/reviewApi';
import type { ReceivedReview, ReviewCursor } from '../types';

/**
 * 방금 받은 페이지를 보고 다음 커서를 정한다.
 *
 * 규칙은 마이페이지 목록(profile/utils/myPostCursor)과 같다 — 한 페이지가 다 차지 않았으면
 * 뒤에 남은 것이 없다는 뜻이다. 딱 떨어질 때 한 번 헛걸음하는 것도 그대로다.
 *
 * TanStack Query의 getNextPageParam은 undefined를 "다음 없음"으로 읽는다.
 */
export function toNextReviewCursor(lastPage: ReceivedReview[]): ReviewCursor | undefined {
  if (lastPage.length < REVIEWS_PAGE_SIZE) {
    return undefined;
  }

  const lastReview = lastPage[lastPage.length - 1];

  return { createdAt: lastReview.createdAt, id: lastReview.id };
}
