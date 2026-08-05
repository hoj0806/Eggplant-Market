import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
} from '@tanstack/react-query';
import { notificationsQueryKey, unreadNotificationCountQueryKey } from './useNotificationQueries';
import { markAllNotificationsRead, markNotificationRead } from '../api/notificationApi';
import {
  withAllNotificationsRead,
  withDecrementedUnread,
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
