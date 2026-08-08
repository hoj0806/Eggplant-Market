import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notificationsQueryKey } from './useNotificationQueries';
import { subscribeToMyNotifications } from '../api/notificationApi';

/**
 * 새 알림이 들어오면 목록과 배지를 다시 읽게 한다.
 *
 * 채팅 메시지(`useChatRoomRealtime`)처럼 payload를 캐시에 직접 꽂지 않는다. Realtime이 주는 것은
 * `notifications` 행 그대로 — id가 든 payload jsonb다. 목록이 쓰는 모양은 서버가 join해서 푼
 * 것이라(0015) 둘이 다르고, 앞에서 풀어 준 값을 화면에서 다시 만들 방법이 없다.
 *
 * 그래서 "무언가 왔다"만 신호로 쓰고 다시 읽는다 — `useChatRoomsRealtime`이 방 목록에
 * 한 것과 같은 판단이다.
 */
export function useNotificationsRealtime(viewerId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(
    function subscribeToNotifications(): (() => void) | undefined {
      if (viewerId === null) {
        return undefined;
      }

      return subscribeToMyNotifications(viewerId, function refresh(): void {
        // 안 읽은 수의 키(`[…, 'unreadCount']`)가 목록 키로 시작하므로 이 한 번이 둘 다 낡게 한다.
        // TanStack Query의 무효화는 앞부분이 같으면 걸린다.
        queryClient.invalidateQueries({ queryKey: notificationsQueryKey(viewerId) });
      });
    },
    [viewerId, queryClient],
  );
}
