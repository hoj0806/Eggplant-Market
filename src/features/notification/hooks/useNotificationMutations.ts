import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
} from '@tanstack/react-query';
import { notificationCountQueryKey, notificationsQueryKey } from './useNotificationQueries';
import { deleteAllNotifications, deleteNotification } from '../api/notificationApi';
import {
  withDecrementedCount,
  withoutAllNotifications,
  withoutNotification,
} from '../utils/notificationCache';
import type { AppNotification } from '../types';

/**
 * 알림에 일어나는 일은 **사라지는 것 하나뿐**이다(0036).
 *
 * 읽음 표시가 있던 자리에는 아무것도 두지 않았다 — 알림을 누르면 가리키던 곳으로 가면서
 * 그 줄이 지워지므로, "봤다"를 따로 적어 둘 이유가 없다. 그래서 뮤테이션도 둘뿐이다.
 */

/** useNotificationsQuery가 캐시에 넣는 모양. setQueryData에 그대로 넘긴다. */
type NotificationCache = InfiniteData<AppNotification[]>;

/**
 * 알림 하나를 지운다. **누르는 길도 여기로 온다.**
 *
 * 두 자리가 같은 뮤테이션을 쓴다 — 줄을 눌러 열 때와 ×를 눌러 치울 때. 하는 일이 같기
 * 때문이다(그 줄이 사라진다). 다른 것은 **누른 뒤 어디에 있느냐**뿐이다.
 *
 * 캐시는 **응답을 받고 나서** 고친다. ×는 그 자리에 남으므로, 실패했는데 줄이 사라졌다가
 * 다시 나타나는 편보다 잠깐 남아 있다 사라지는 편이 낫다. 줄을 눌러 화면이 넘어간 경우에도
 * 이 콜백은 그대로 돈다 — 뮤테이션에 걸어 둔 콜백은 컴포넌트가 사라져도 실행되므로,
 * 돌아왔을 때 그 줄은 이미 없다.
 *
 * 배지는 **언제나 하나** 준다. 남아 있는 알림을 세기 때문에 사라지면 그만큼 준다.
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
      queryClient.setQueryData<number>(notificationCountQueryKey(viewerId), withDecrementedCount);
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
 * 목록은 첫 페이지만 받아 온 상태일 수 있고 배지는 전체를 센다. 다 지웠으면 0이다.
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
