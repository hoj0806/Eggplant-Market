import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
} from '@tanstack/react-query';
import { notificationsQueryKey, unreadNotificationCountQueryKey } from './useNotificationQueries';
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notificationApi';
import {
  withAllNotificationsRead,
  withDecrementedUnread,
  withoutNotification,
  withReadNotification,
} from '../utils/notificationCache';
import type { AppNotification } from '../types';

/** useNotificationsQuery가 캐시에 넣는 모양. setQueryData에 그대로 넘긴다. */
type NotificationCache = InfiniteData<AppNotification[]>;

export type MarkNotificationReadInput = {
  id: number;
  /** 누를 때 이미 읽은 상태였는가. 배지를 두 번 깎지 않기 위해 필요하다. */
  wasRead: boolean;
};

/**
 * 알림 하나를 읽음으로.
 *
 * 캐시를 **보내기 전에** 고친다. 알림을 누르면 곧바로 화면이 넘어가므로 응답을 기다렸다
 * 고치면 그 결과를 받을 화면이 이미 없다. 실패해도 되돌리지 않는다 — 잃는 것이 굵은 글씨
 * 하나뿐이고, 다음 조회가 서버 값으로 덮는다.
 */
export function useMarkNotificationReadMutation(
  viewerId: string | null,
): UseMutationResult<void, Error, MarkNotificationReadInput> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, MarkNotificationReadInput>({
    mutationFn: function markRead(input: MarkNotificationReadInput): Promise<void> {
      return markNotificationRead(input.id);
    },
    onMutate: function updateCache(input: MarkNotificationReadInput): void {
      queryClient.setQueryData<NotificationCache>(
        notificationsQueryKey(viewerId),
        function markOne(current) {
          return withReadNotification(current, input.id);
        },
      );
      queryClient.setQueryData<number>(
        unreadNotificationCountQueryKey(viewerId),
        function decrement(current) {
          return withDecrementedUnread(current, input.wasRead);
        },
      );
    },
  });
}

export type DeleteNotificationInput = {
  id: number;
  /** 지울 때 이미 읽은 상태였는가. 안 읽은 것을 지우면 배지도 함께 줄어야 한다. */
  wasRead: boolean;
};

/**
 * 알림 하나를 지운다.
 *
 * 화면에 머무른 채 누르는 버튼이라 **응답을 받고 나서** 캐시를 고친다. 읽음 표시가 보내기
 * 전에 고쳤던 것은 누르는 즉시 다른 화면으로 넘어가기 때문인데, 삭제는 그 자리에 남는다 —
 * 실패했는데 줄이 사라졌다가 다시 나타나는 편보다 잠깐 남아 있다 사라지는 편이 낫다.
 *
 * 배지는 읽음 표시와 같은 함수로 줄인다. 안 읽은 알림이 사라지면 `count_unread_notifications`도
 * 하나 줄어들므로, 화면이 먼저 같은 만큼 줄여 두어야 다음 조회까지 숫자가 어긋나지 않는다.
 */
export function useDeleteNotificationMutation(
  viewerId: string | null,
): UseMutationResult<void, Error, DeleteNotificationInput> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteNotificationInput>({
    mutationFn: function removeOne(input: DeleteNotificationInput): Promise<void> {
      return deleteNotification(input.id);
    },
    onSuccess: function updateCache(_result: void, input: DeleteNotificationInput): void {
      queryClient.setQueryData<NotificationCache>(
        notificationsQueryKey(viewerId),
        function removeOne(current) {
          return withoutNotification(current, input.id);
        },
      );
      queryClient.setQueryData<number>(
        unreadNotificationCountQueryKey(viewerId),
        function decrement(current) {
          return withDecrementedUnread(current, input.wasRead);
        },
      );
    },
  });
}

/**
 * 안 읽은 알림을 모두 읽음으로.
 *
 * 이쪽은 화면에 머무른 채 누르는 버튼이라 응답을 받고 나서 고친다.
 * 실패하면 굵은 글씨가 그대로 남아 다시 누를 수 있다.
 */
export function useMarkAllNotificationsReadMutation(
  viewerId: string | null,
): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: markAllNotificationsRead,
    onSuccess: function updateCache(): void {
      queryClient.setQueryData<NotificationCache>(
        notificationsQueryKey(viewerId),
        withAllNotificationsRead,
      );
      queryClient.setQueryData<number>(unreadNotificationCountQueryKey(viewerId), 0);
    },
  });
}
