import { Link, Navigate } from 'react-router-dom';
import ChatRoomListItem from './chatRoomListItem';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useChatRoomsQuery } from '../hooks/useChatQueries';
import { useChatRoomsRealtime } from '../hooks/useChatRealtime';

const MESSAGE_CLASS = 'py-8 text-center text-sm text-gray-500 dark:text-gray-400';

function ChatRoomListPage() {
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const viewerId = user?.id ?? null;

  const roomsQuery = useChatRoomsQuery(viewerId);
  useChatRoomsRealtime(viewerId);

  // 라우트 가드(RequireOnboarding)는 게스트를 통과시킨다. 채팅은 로그인이 있어야 한다.
  if (status === 'loading') {
    return <PageSpinner message="세션을 확인하는 중입니다…" />;
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  const rooms = roomsQuery.data ?? [];
  const now = new Date();

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">채팅</h1>
        <Link
          to="/"
          className="text-sm text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          홈으로 →
        </Link>
      </header>

      {roomsQuery.isLoading ? <p className={MESSAGE_CLASS}>채팅방을 불러오는 중입니다…</p> : null}

      {roomsQuery.isError ? (
        <p role="alert" className={MESSAGE_CLASS}>
          채팅방을 불러오지 못했습니다.
        </p>
      ) : null}

      {!roomsQuery.isLoading && !roomsQuery.isError && rooms.length === 0 ? (
        <p className={MESSAGE_CLASS}>아직 채팅한 이웃이 없어요.</p>
      ) : null}

      <ul className="flex flex-col gap-1">
        {rooms.map(function renderRoom(room) {
          return <ChatRoomListItem key={room.id} room={room} now={now} />;
        })}
      </ul>
    </main>
  );
}

export default ChatRoomListPage;
