import { useEffect } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { chatMessagesQueryKey, chatRoomQueryKey, chatRoomsQueryKey } from './useChatQueries';
import { subscribeToMyChatRooms, subscribeToRoomMessages } from '../api/chatApi';
import { withInsertedMessage, withUpdatedMessage } from '../utils/chatMessageCache';
import type { ChatMessage } from '../types';

/** useChatMessagesQuery가 캐시에 넣는 모양. setQueryData에 그대로 넘긴다. */
type ChatMessageCache = InfiniteData<ChatMessage[]>;

/**
 * 이 방의 새 메시지·읽음 표시를 실시간으로 받아 캐시에 반영한다.
 *
 * 화면은 여전히 TanStack Query만 본다. Realtime은 캐시를 갱신할 뿐이다
 * (docs/architecture.md의 방침).
 */
export function useChatRoomRealtime(roomId: number | null): void {
  const queryClient = useQueryClient();

  useEffect(
    function subscribeToRoom(): (() => void) | undefined {
      if (roomId === null) {
        return undefined;
      }

      return subscribeToRoomMessages(
        roomId,
        function handleInsert(message: ChatMessage): void {
          queryClient.setQueryData<ChatMessageCache>(chatMessagesQueryKey(roomId), function add(current) {
            return withInsertedMessage(current, message);
          });
          // 목록의 마지막 메시지와 안 읽은 수도 같이 낡는다.
          queryClient.invalidateQueries({ queryKey: chatRoomsQueryKey() });
          queryClient.invalidateQueries({ queryKey: chatRoomQueryKey(roomId) });
        },
        function handleUpdate(message: ChatMessage): void {
          queryClient.setQueryData<ChatMessageCache>(chatMessagesQueryKey(roomId), function replace(current) {
            return withUpdatedMessage(current, message);
          });
        },
        function handleReady(): void {
          // 첫 조회와 구독이 자리 잡는 사이에 온 메시지는 어느 쪽에도 안 잡힌다. 그 틈을 메운다.
          queryClient.invalidateQueries({ queryKey: chatMessagesQueryKey(roomId) });
        },
      );
    },
    [roomId, queryClient],
  );
}

/**
 * 채팅 목록이 실시간으로 따라 움직이게 한다.
 *
 * 방마다 채널을 열지 않는다 — 방이 늘어날수록 채널이 늘고, 목록에 필요한 것은
 * "무언가 바뀌었다"뿐이다. chat_rooms는 메시지가 들어올 때마다 트리거가 갱신한다(0001).
 */
export function useChatRoomsRealtime(viewerId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(
    function subscribeToRooms(): (() => void) | undefined {
      if (viewerId === null) {
        return undefined;
      }

      return subscribeToMyChatRooms(function refreshRooms(): void {
        queryClient.invalidateQueries({ queryKey: chatRoomsQueryKey() });
      });
    },
    [viewerId, queryClient],
  );
}
