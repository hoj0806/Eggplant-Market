import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
} from '@tanstack/react-query';
import { notificationCountQueryKey, notificationsQueryKey } from './useNotificationQueries';
import {
  deleteAllNotifications,
  deleteNotification,
  markNotificationRead,
} from '../api/notificationApi';
import {
  withDecrementedCount,
  withoutAllNotifications,
  withoutNotification,
  withReadNotification,
} from '../utils/notificationCache';
import type { AppNotification } from '../types';

/** useNotificationsQuery가 캐시에 넣는 모양. setQueryData에 그대로 넘긴다. */
type NotificationCache = InfiniteData<AppNotification[]>;

/**
 * 알림 하나를 읽음으로.
 *
 * 캐시를 **보내기 전에** 고친다. 알림을 누르면 곧바로 화면이 넘어가므로 응답을 기다렸다
 * 고치면 그 결과를 받을 화면이 이미 없다. 실패해도 되돌리지 않는다 — 잃는 것이 굵은 글씨
 * 하나뿐이고, 다음 조회가 서버 값으로 덮는다.
 *
 * **배지는 건드리지 않는다** (2026-08-10). 배지가 세는 것이 "안 읽은 것"에서 **"남아 있는
 * 것"** 으로 바뀌었기 때문이다 — 읽어도 줄은 그대로 있으니 숫자도 그대로다.
 * 그래서 "누를 때 이미 읽었는가"(`wasRead`)를 받을 이유도 함께 사라졌다.
 */
export function useMarkNotificationReadMutation(
  viewerId: string | null,
): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: function markRead(notificationId: number): Promise<void> {
      return markNotificationRead(notificationId);
    },
    onMutate: function updateCache(notificationId: number): void {
      queryClient.setQueryData<NotificationCache>(
        notificationsQueryKey(viewerId),
        function markOne(current) {
          return withReadNotification(current, notificationId);
        },
      );
    },
  });
}

/**
 * 알림 하나를 지운다.
 *
 * 화면에 머무른 채 누르는 버튼이라 **응답을 받고 나서** 캐시를 고친다. 읽음 표시가 보내기
 * 전에 고쳤던 것은 누르는 즉시 다른 화면으로 넘어가기 때문인데, 삭제는 그 자리에 남는다 —
 * 실패했는데 줄이 사라졌다가 다시 나타나는 편보다 잠깐 남아 있다 사라지는 편이 낫다.
 *
 * **배지는 언제나 하나 준다.** 읽었든 안 읽었든 줄 하나가 사라지기 때문이다 —
 * 배지가 "남아 있는 것"을 세게 되면서 읽음 여부를 물을 일이 없어졌다.
 */
export function useDeleteNotificationMutation(
  viewerId: string | null,
): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: function removeOne(notificationId: number): Promise<void> {
      return deleteNotification(notificationId);
    },
    onSuccess: function updateCache(_result: void, notificationId: number): void {
      queryClient.setQueryData<NotificationCache>(
        notificationsQueryKey(viewerId),
        function removeOne(current) {
          return withoutNotification(current, notificationId);
        },
      );
      queryClient.setQueryData<number>(
        notificationCountQueryKey(viewerId),
        withDecrementedCount,
      );
    },
  });
}

/**
 * 알림을 모두 지운다.
 *
 * 캐시를 고치는 방식은 한 줄 삭제와 같다 — **응답을 받고 나서.** 화면에 머무른 채 누르는
 * 버튼이라 실패하면 목록이 그대로 남아 다시 누를 수 있다.
 *
 * 배지는 하나씩 깎지 않고 **0으로 놓는다.** 몇 줄이었는지 화면이 모르기 때문이다 —
 * 목록은 첫 페이지만 받아 온 상태일 수 있고 배지는 전체를 센다. **다 지웠으면 0이다.**
 */
export function useDeleteAllNotificationsMutation(
  viewerId: string | null,
): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: deleteAllNotifications,
    onSuccess: function updateCache(): void {
      queryClient.setQueryData<NotificationCache>(
        notificationsQueryKey(viewerId),
        withoutAllNotifications,
      );
      queryClient.setQueryData<number>(notificationCountQueryKey(viewerId), 0);
    },
  });
}
