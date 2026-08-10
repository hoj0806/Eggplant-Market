import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { fetchNotificationCount, fetchNotifications } from '../api/notificationApi';
import { toNextNotificationCursor } from '../utils/notificationCursor';
import type { AppNotification, NotificationCursor } from '../types';

/**
 * 알림은 Realtime이 새 것을 알려 주므로 시간으로 낡을 이유가 거의 없다.
 * 그래도 0으로 두지는 않는다 — 목록과 배지를 오가며 매번 다시 부르게 된다.
 */
const NOTIFICATIONS_STALE_TIME_MS = 30_000;

export type NotificationsQueryResult = UseInfiniteQueryResult<
  InfiniteData<AppNotification[]>,
  Error
>;

/**
 * 알림은 전부 내 것이라 서버는 사용자 id를 받지 않는다. 그래도 키에는 넣는다 —
 * 넣지 않으면 계정을 바꿔 들어왔을 때 앞사람의 알림이 그대로 남는다
 * (pendingReviewsQueryKey와 같은 이유).
 */
export function notificationsQueryKey(userId: string | null): ReadonlyArray<string> {
  return ['notifications', userId ?? 'anonymous'];
}

export function notificationCountQueryKey(userId: string | null): ReadonlyArray<string> {
  return ['notifications', userId ?? 'anonymous', 'count'];
}

/** 내 알림 목록. 무한 스크롤이다. */
export function useNotificationsQuery(userId: string | null): NotificationsQueryResult {
  return useInfiniteQuery<AppNotification[], Error, InfiniteData<AppNotification[]>>({
    queryKey: notificationsQueryKey(userId),
    queryFn: function loadPage({ pageParam }): Promise<AppNotification[]> {
      return fetchNotifications((pageParam as NotificationCursor | null) ?? null);
    },
    initialPageParam: null,
    getNextPageParam: toNextNotificationCursor,
    enabled: userId !== null,
    staleTime: NOTIFICATIONS_STALE_TIME_MS,
  });
}

/**
 * 남아 있는 알림 수. 배지 하나를 위한 조회다.
 *
 * 목록 쿼리를 나눠 쓰지 않는다 — 목록은 무한 스크롤이라 첫 페이지만 받은 상태에서는
 * 세어 봐야 20까지밖에 못 센다. 채팅 배지(useUnreadChatCount)가 목록을 그대로 합칠 수 있었던 것은
 * 방 목록이 페이징 없이 통째로 오기 때문이다.
 */
export function useNotificationCountQuery(
  userId: string | null,
): UseQueryResult<number, Error> {
  return useQuery<number, Error>({
    queryKey: notificationCountQueryKey(userId),
    queryFn: fetchNotificationCount,
    enabled: userId !== null,
    staleTime: NOTIFICATIONS_STALE_TIME_MS,
  });
}
