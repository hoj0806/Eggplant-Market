import { NOTIFICATIONS_PAGE_SIZE } from '../api/notificationApi';
import type { AppNotification, NotificationCursor } from '../types';

/**
 * 방금 받은 페이지를 보고 다음 커서를 정한다.
 *
 * 규칙은 받은 후기(review/utils/reviewCursor)와 같다 — 한 페이지가 다 차지 않았으면
 * 뒤에 남은 것이 없다는 뜻이다. 딱 떨어질 때 한 번 헛걸음하는 것도 그대로다.
 *
 * TanStack Query의 getNextPageParam은 undefined를 "다음 없음"으로 읽는다.
 */
export function toNextNotificationCursor(
  lastPage: AppNotification[],
): NotificationCursor | undefined {
  if (lastPage.length < NOTIFICATIONS_PAGE_SIZE) {
    return undefined;
  }

  const lastNotification = lastPage[lastPage.length - 1];

  return { createdAt: lastNotification.createdAt, id: lastNotification.id };
}
