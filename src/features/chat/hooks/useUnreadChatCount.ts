import { useChatRoomsQuery } from './useChatQueries';
import { useChatRoomsRealtime } from './useChatRealtime';
import type { ChatRoomSummary } from '../types';

/**
 * 안 읽은 메시지 총합. 탭바 배지가 쓴다.
 *
 * 방 목록을 그대로 합쳐서 낸다 — 목록 화면과 같은 쿼리라 캐시를 나눠 쓰고,
 * 탭바가 늘 떠 있는 덕분에 채팅 목록 화면이 즉시 뜬다.
 *
 * 방 **수**가 아니라 메시지 **수**다. 목록 안의 '안읽음' 탭과는 다른 숫자다
 * (chatRoomFilter의 countUnreadRooms 참고).
 */
export function useUnreadChatCount(viewerId: string | null): number {
  const roomsQuery = useChatRoomsQuery(viewerId);
  useChatRoomsRealtime(viewerId);

  return (roomsQuery.data ?? []).reduce(function sumUnread(
    total: number,
    room: ChatRoomSummary,
  ): number {
    return total + room.unreadCount;
  }, 0);
}
