import { Link, Navigate, useParams } from 'react-router-dom';
import ChatComposer from './chatComposer';
import ChatMessageList from './chatMessageList';
import ChatPostHeader from './chatPostHeader';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import ProfileAvatar from '../../profile/components/profileAvatar';
import { useChatMessagesQuery, useChatRoomQuery } from '../hooks/useChatQueries';
import { useChatRoomRealtime } from '../hooks/useChatRealtime';
import {
  useSendImageMessagesMutation,
  useSendTextMessageMutation,
} from '../hooks/useChatMutations';
import { countUnreadFromPartner, useMarkRoomRead } from '../hooks/useMarkRoomRead';
import { toMessageTimeline } from '../utils/chatCursor';
import { toChatErrorMessage } from '../utils/chatErrorMessage';

/** 주소의 :roomId는 문자열이다. 숫자가 아니면 없는 방으로 본다. */
function toRoomId(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null;
  }

  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function ChatRoomPage() {
  const params = useParams();
  const roomId = toRoomId(params.roomId);
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const viewerId = user?.id ?? null;

  const roomQuery = useChatRoomQuery(roomId);
  const messagesQuery = useChatMessagesQuery(roomId);
  const messages = toMessageTimeline(messagesQuery.data?.pages ?? []);

  useChatRoomRealtime(roomId);
  // 방 요약이 아니라 화면에 있는 메시지로 센다. 실시간으로 도착한 순간 바로 읽음이 된다.
  useMarkRoomRead(roomId, viewerId, countUnreadFromPartner(messages, viewerId));

  // roomId가 null이면 훅은 아무것도 하지 않지만 훅 자체는 언제나 같은 순서로 불려야 한다.
  const sendText = useSendTextMessageMutation(roomId ?? 0, viewerId);
  const sendImages = useSendImageMessagesMutation(roomId ?? 0, viewerId);

  if (status === 'loading') {
    return <PageSpinner message="세션을 확인하는 중입니다…" />;
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (roomId === null || roomQuery.isError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col items-center justify-center gap-3 p-6">
        <p className="text-gray-700 dark:text-gray-200">채팅방을 찾을 수 없습니다.</p>
        <Link
          to="/chats"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          채팅 목록으로
        </Link>
      </main>
    );
  }

  if (roomQuery.isLoading || roomQuery.data === undefined || viewerId === null) {
    return <PageSpinner message="채팅방을 불러오는 중입니다…" />;
  }

  const room = roomQuery.data;
  const sendError = sendText.error ?? sendImages.error;

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-3 p-6">
      <header className="flex items-center gap-2">
        <Link
          to="/chats"
          className="text-sm text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ←
        </Link>
        <ProfileAvatar
          nickname={room.partner.nickname}
          avatarUrl={room.partner.avatarUrl}
          size="sm"
        />
        <h1 className="truncate text-base font-semibold text-gray-900 dark:text-gray-50">
          {room.partner.nickname}
        </h1>
      </header>

      <ChatPostHeader room={room} viewerId={viewerId} />

      <ChatMessageList
        messages={messages}
        viewerId={viewerId}
        isLoading={messagesQuery.isLoading}
        isError={messagesQuery.isError}
        hasNextPage={messagesQuery.hasNextPage}
        isFetchingNextPage={messagesQuery.isFetchingNextPage}
        onLoadMore={function loadOlder(): void {
          void messagesQuery.fetchNextPage();
        }}
      />

      {sendError === null ? null : (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {toChatErrorMessage(sendError)}
        </p>
      )}

      <ChatComposer
        isSending={sendText.isPending || sendImages.isPending}
        onSendText={function handleSendText(text: string): void {
          sendText.mutate({ text });
        }}
        onSendImages={function handleSendImages(files: File[]): void {
          sendImages.mutate({ files });
        }}
      />
    </main>
  );
}

export default ChatRoomPage;
