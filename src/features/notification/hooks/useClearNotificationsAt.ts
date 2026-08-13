import { useEffect, useRef } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { notificationCountQueryKey, notificationsQueryKey } from './useNotificationQueries';
import { deleteNotificationsAt, type NotificationPlace } from '../api/notificationApi';
import { withCountReducedBy, withoutNotifications } from '../utils/notificationCache';
import type { AppNotification } from '../types';

/** 같은 곳에 두 번 도착한 것으로 치지 않기 위한 열쇠. StrictMode가 effect를 두 번 돌린다. */
function toPlaceKey(place: NotificationPlace): string {
  return place.kind === 'room' ? `room:${place.roomId}` : `post:${place.postId}`;
}

/**
 * **도착한 화면의 알림을 치운다.**
 *
 * 알림을 눌러 들어와야만 사라지던 것을 고친다. 채팅 목록에서 방을 열거나 홈에서 글을 눌러
 * 들어와도 확인한 것은 마찬가지인데, 전에는 알림이 남아 종 배지가 안 줄었다.
 *
 * `useMarkRoomRead`와 같은 모양이다 — 화면이 열릴 때 한 번 돌고, **실패는 조용히 넘긴다.**
 * 사용자가 누른 일이 아니라 곁가지고, 다음에 그 화면을 열면 다시 시도된다.
 *
 * 로그인하지 않았으면 아무것도 하지 않는다. 알림은 전부 남의 것이라 지울 것이 없고,
 * 보내 봐야 0건 삭제로 끝난다(RLS가 조용히 건너뛴다).
 *
 * 캐시는 **응답을 받고 나서** 고친다. 지워진 id를 그대로 받아 목록에서 빼고 배지를 그만큼
 * 깎는다 — 다시 세러 가는 왕복이 없다. 화면이 이미 넘어간 뒤라도 콜백은 그대로 돌아,
 * 알림 목록으로 돌아왔을 때 그 줄들은 이미 없다.
 */
export function useClearNotificationsAt(
  place: NotificationPlace | null,
  viewerId: string | null,
): void {
  const handledRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  // effect가 **값**이 아니라 열쇠를 본다. 부르는 쪽이 `{ kind: 'room', roomId }`를 그 자리에서
  // 만들면 렌더마다 새 객체라, 객체를 의존성에 두면 effect가 매번 다시 돈다.
  const placeKey = place === null ? null : toPlaceKey(place);
  const placeRef = useRef(place);
  placeRef.current = place;

  useEffect(
    function clearOnArrival(): void {
      const current = placeRef.current;

      if (current === null || placeKey === null || viewerId === null) {
        return;
      }

      const attempt = `${viewerId}:${placeKey}`;
      if (handledRef.current === attempt) {
        return;
      }
      handledRef.current = attempt;

      deleteNotificationsAt(current)
        .then(function updateCache(removedIds: number[]): void {
          if (removedIds.length === 0) {
            return;
          }

          queryClient.setQueryData<InfiniteData<AppNotification[]>>(
            notificationsQueryKey(viewerId),
            function removeArrived(current) {
              return withoutNotifications(current, removedIds);
            },
          );
          queryClient.setQueryData<number>(
            notificationCountQueryKey(viewerId),
            function reduceBadge(current) {
              return withCountReducedBy(current, removedIds.length);
            },
          );
        })
        .catch(function ignoreClearFailure(): void {
          // 알림 치우기는 곁가지다. 방과 글은 이미 열렸고, 실패를 사용자에게 알리지 않는다.
        });
    },
    [placeKey, viewerId, queryClient],
  );
}
