import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { chatRoomQueryKey, chatRoomsQueryKey } from './useChatQueries';
import { markRoomRead } from '../api/chatApi';
import type { ChatMessage } from '../types';

/**
 * 이 방에서 내가 아직 읽지 않은 메시지 수.
 *
 * 방 요약(`fetch_chat_rooms`의 unread_count)이 아니라 **화면에 이미 있는 메시지**로 센다.
 * 요약을 쓰면 상대의 메시지가 도착한 뒤 요약을 다시 받아오는 왕복이 한 번 더 끼어,
 * 상대 화면의 "안읽음"이 그만큼 늦게 사라진다(실제로 21초까지 벌어지는 것을 확인했다).
 * 실시간 이벤트가 캐시에 얹히는 순간 이 값이 바뀌므로 왕복이 필요 없다.
 *
 * 안 읽어 온 페이지의 메시지는 세지 않지만 상관없다. 이 값은 "읽음 처리를 할 때인가"를
 * 알리는 방아쇠일 뿐이고, 실제 갱신은 서버에서 방 전체를 대상으로 한다.
 *
 * 지운 메시지는 세지 않는다 — 서버가 배지에서 빼는 것과 같은 기준이다(0029). 안 맞추면
 * 상대가 지운 줄 하나 때문에 방에 들어갈 때마다 읽음 처리 요청이 한 번씩 더 나간다.
 */
export function countUnreadFromPartner(
  messages: ReadonlyArray<ChatMessage>,
  viewerId: string | null,
): number {
  if (viewerId === null) {
    return 0;
  }

  return messages.filter(function isUnreadFromPartner(message: ChatMessage): boolean {
    return message.senderId !== viewerId && message.readAt === null && message.deletedAt === null;
  }).length;
}

/**
 * 방을 보고 있는 동안 받은 메시지를 읽음으로 표시한다.
 *
 * 개수가 바뀔 때마다 다시 돈다 — 방에 머무는 중에 새 메시지가 오면
 * 그것도 곧바로 읽은 것이 되어야 상대의 "안읽음" 표시가 사라진다.
 *
 * 같은 개수로 두 번 도는 것은 막는다. StrictMode가 effect를 두 번 실행하는 데다,
 * 읽음 처리가 방 요약을 다시 받아 오게 만들어 그대로 두면 요청이 꼬리를 문다.
 *
 * 실패해도 조용히 넘어간다. 사용자가 누른 일이 아니고 다음에 방을 열 때 다시 시도된다.
 */
export function useMarkRoomRead(
  roomId: number | null,
  viewerId: string | null,
  unreadCount: number,
): void {
  const handledRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(
    function markReadWhenUnread(): void {
      if (roomId === null || viewerId === null || unreadCount === 0) {
        return;
      }

      const attempt = `${roomId}:${unreadCount}`;
      if (handledRef.current === attempt) {
        return;
      }
      handledRef.current = attempt;

      markRoomRead(roomId, viewerId)
        .then(function refreshRooms(): void {
          queryClient.invalidateQueries({ queryKey: chatRoomsQueryKey() });
          queryClient.invalidateQueries({ queryKey: chatRoomQueryKey(roomId) });
        })
        .catch(function ignoreMarkReadFailure(): void {
          // 읽음 표시는 곁가지다. 실패를 사용자에게 알리지 않는다.
        });
    },
    [roomId, viewerId, unreadCount, queryClient],
  );
}
