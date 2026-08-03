import { Link } from 'react-router-dom';
import { useChatRoomsQuery } from '../hooks/useChatQueries';
import { useChatRoomsRealtime } from '../hooks/useChatRealtime';
import type { ChatRoomSummary } from '../types';

type ChatEntryLinkProps = {
  viewerId: string;
};

/**
 * 홈에서 채팅으로 들어가는 입구.
 *
 * 안 읽은 수는 방 목록을 그대로 합쳐서 낸다 — 목록 화면과 같은 쿼리라 캐시를 나눠 쓰고,
 * 홈에서 이미 받아 둔 값 덕분에 목록 화면이 즉시 뜬다.
 */
function ChatEntryLink(props: ChatEntryLinkProps) {
  const roomsQuery = useChatRoomsQuery(props.viewerId);
  useChatRoomsRealtime(props.viewerId);

  const unreadTotal = (roomsQuery.data ?? []).reduce(function sumUnread(
    total: number,
    room: ChatRoomSummary,
  ): number {
    return total + room.unreadCount;
  }, 0);

  return (
    <Link
      to="/chats"
      className="relative rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium
                 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700
                 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      💬 채팅
      {unreadTotal > 0 ? (
        <span
          aria-label={`안 읽은 메시지 ${unreadTotal}개`}
          className="absolute -right-1.5 -top-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5
                     text-[10px] font-semibold text-white"
        >
          {unreadTotal}
        </span>
      ) : null}
    </Link>
  );
}

export default ChatEntryLink;
