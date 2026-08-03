import { Navigate, useSearchParams } from 'react-router-dom';
import ChatRoomFilterTabs from './chatRoomFilterTabs';
import ChatRoomListItem from './chatRoomListItem';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useChatRoomsQuery } from '../hooks/useChatQueries';
import { useChatRoomsRealtime } from '../hooks/useChatRealtime';
import {
  countUnreadRooms,
  DEFAULT_CHAT_ROOM_FILTER,
  filterChatRooms,
  toChatRoomFilter,
  type ChatRoomFilter,
} from '../utils/chatRoomFilter';

const MESSAGE_CLASS = 'py-8 text-center text-sm text-gray-500 dark:text-gray-400';

const FILTER_PARAM = 'tab';

const EMPTY_MESSAGE_BY_FILTER: Record<ChatRoomFilter, string> = {
  all: '아직 채팅한 이웃이 없어요.',
  sales: '내 물건을 사겠다고 온 채팅이 없어요.',
  purchases: '내가 사겠다고 건 채팅이 없어요.',
  unread: '안 읽은 채팅이 없어요.',
};

/**
 * 채팅 목록.
 *
 * 고른 갈래의 원본은 컴포넌트 state가 아니라 URL이다. 채팅은 방을 자주 드나드는 화면이라
 * 방에 들어갔다 뒤로 나올 때마다 '전체'로 돌아가면 매번 다시 골라야 한다.
 */
function ChatRoomListPage() {
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const viewerId = user?.id ?? null;

  const [searchParams, setSearchParams] = useSearchParams();
  const roomsQuery = useChatRoomsQuery(viewerId);
  useChatRoomsRealtime(viewerId);

  const filter = toChatRoomFilter(searchParams.get(FILTER_PARAM));

  function handleFilterChange(next: ChatRoomFilter): void {
    const params = new URLSearchParams(searchParams);

    if (next === DEFAULT_CHAT_ROOM_FILTER) {
      // 기본값은 주소에 남기지 않는다. /chats가 채팅 목록의 이름이다.
      params.delete(FILTER_PARAM);
    } else {
      params.set(FILTER_PARAM, next);
    }

    // 탭을 몇 번 눌렀는지가 뒤로가기 횟수가 되면 안 된다.
    setSearchParams(params, { replace: true });
  }

  // 라우트 가드(RequireOnboarding)는 게스트를 통과시킨다. 채팅은 로그인이 있어야 한다.
  if (status === 'loading') {
    return <PageSpinner message="세션을 확인하는 중입니다…" />;
  }
  if (status === 'unauthenticated' || viewerId === null) {
    return <Navigate to="/login" replace />;
  }

  const rooms = roomsQuery.data ?? [];
  const visibleRooms = filterChatRooms(rooms, filter, viewerId);
  const now = new Date();

  const isReady = !roomsQuery.isLoading && !roomsQuery.isError;

  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-6">
      <header>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">채팅</h1>
      </header>

      <ChatRoomFilterTabs
        value={filter}
        unreadCount={countUnreadRooms(rooms)}
        onChange={handleFilterChange}
      />

      {roomsQuery.isLoading ? <p className={MESSAGE_CLASS}>채팅방을 불러오는 중입니다…</p> : null}

      {roomsQuery.isError ? (
        <p role="alert" className={MESSAGE_CLASS}>
          채팅방을 불러오지 못했습니다.
        </p>
      ) : null}

      {isReady && visibleRooms.length === 0 ? (
        <p className={MESSAGE_CLASS}>{EMPTY_MESSAGE_BY_FILTER[filter]}</p>
      ) : null}

      <ul className="flex flex-col gap-1">
        {visibleRooms.map(function renderRoom(room) {
          return <ChatRoomListItem key={room.id} room={room} viewerId={viewerId} now={now} />;
        })}
      </ul>
    </main>
  );
}

export default ChatRoomListPage;
