import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import ChatComposer from './chatComposer';
import ChatMessageList from './chatMessageList';
import ChatPostHeader from './chatPostHeader';
import LeaveChatRoomButton from './leaveChatRoomButton';
import BackLink from '../../../shared/ui/backLink';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import SafetyMenu from '../../block/components/safetyMenu';
import ProfileAvatar from '../../profile/components/profileAvatar';
import { useChatMessagesQuery, useChatRoomQuery } from '../hooks/useChatQueries';
import { useChatRoomRealtime } from '../hooks/useChatRealtime';
import {
  useCancelOfferMutation,
  useDeleteMessageMutation,
  useRespondToOfferMutation,
  useSendImageMessagesMutation,
  useSendPriceOfferMutation,
  useSendTextMessageMutation,
} from '../hooks/useChatMutations';
import { countUnreadFromPartner, useMarkRoomRead } from '../hooks/useMarkRoomRead';
import { toMessageTimeline } from '../utils/chatCursor';
import { toChatErrorMessage } from '../utils/chatErrorMessage';
import { canSendPriceOffer, hasPendingOfferFrom } from '../utils/priceOffer';
import type { OfferResponse } from '../types';

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
  const navigate = useNavigate();
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
  const sendOffer = useSendPriceOfferMutation(roomId ?? 0, viewerId);
  const respondToOffer = useRespondToOfferMutation(roomId ?? 0);
  const cancelOffer = useCancelOfferMutation(roomId ?? 0);
  const deleteMessage = useDeleteMessageMutation(roomId ?? 0);

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
  const sendError =
    sendText.error ??
    sendImages.error ??
    sendOffer.error ??
    respondToOffer.error ??
    // 취소 실패도 같은 줄에 적는다. 사용자에게는 "방금 누른 것이 안 됐다" 하나다.
    cancelOffer.error ??
    deleteMessage.error;

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-3 p-6">
      <header className="flex items-center gap-2">
        {/*
          이 헤더만 PageHeader를 쓰지 않는다 — 한 줄에 아바타·상대 이름·신고 메뉴가 함께 있어
          "링크와 action" 두 칸으로 나뉘지 않는다. 대신 BackLink를 같이 써서 생김새를 맞춘다.
          글자는 감추되 이름은 남긴다(지금까지는 `←` 한 글자라 이름 없는 링크였다).
        */}
        <BackLink to="/chats" label="채팅 목록" isLabelHidden />
        <ProfileAvatar
          nickname={room.partner.nickname}
          avatarUrl={room.partner.avatarUrl}
          size="sm"
        />
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-gray-900 dark:text-gray-50">
          {room.partner.nickname}
        </h1>

        {/*
          대화 중에 이상함을 느끼는 자리다. 차단하면 이 방이 목록에서 사라지고
          주소로도 열리지 않으므로(0014의 fetch_chat_rooms) 곧바로 "채팅방을 찾을 수 없습니다"가 된다.
        */}
        <SafetyMenu
          viewerId={viewerId}
          targetUserId={room.partner.id}
          targetNickname={room.partner.nickname}
          /*
            나가기는 신고·차단과 결이 다르지만 같은 메뉴에 둔다. 헤더 한 줄에 ⋯를 둘 놓을
            자리가 없고, 셋 다 "이 대화를 어떻게 할까"를 정하는 자리라 찾는 곳이 같다.
          */
          extraItems={
            <LeaveChatRoomButton
              roomId={roomId}
              participantIds={[viewerId, room.partner.id]}
              onLeft={function goToRoomList(): void {
                // replace다. 뒤로가기로 방금 나온 방에 다시 들어가면 목록에는 없는데
                // 화면은 열려 있는 상태가 된다.
                void navigate('/chats', { replace: true });
              }}
            />
          }
        />
      </header>

      <ChatPostHeader room={room} viewerId={viewerId} />

      <ChatMessageList
        messages={messages}
        viewerId={viewerId}
        isLoading={messagesQuery.isLoading}
        isError={messagesQuery.isError}
        hasNextPage={messagesQuery.hasNextPage}
        isFetchingNextPage={messagesQuery.isFetchingNextPage}
        isRespondingToOffer={respondToOffer.isPending}
        isCancellingOffer={cancelOffer.isPending}
        isDeletingMessage={deleteMessage.isPending}
        onLoadMore={function loadOlder(): void {
          void messagesQuery.fetchNextPage();
        }}
        onRespondToOffer={function handleRespond(messageId: number, status: OfferResponse): void {
          respondToOffer.mutate({ messageId, status });
        }}
        onCancelOffer={function handleCancel(messageId: number): void {
          cancelOffer.mutate({ messageId });
        }}
        onDeleteMessage={function handleDelete(messageId: number, imagePath?: string): void {
          deleteMessage.mutate({ messageId, imagePath });
        }}
      />

      {sendError === null ? null : (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {toChatErrorMessage(sendError)}
        </p>
      )}

      <ChatComposer
        isSending={sendText.isPending || sendImages.isPending || sendOffer.isPending}
        canOfferPrice={canSendPriceOffer(room, viewerId)}
        postPrice={room.postPrice}
        hasPendingOffer={hasPendingOfferFrom(messages, viewerId)}
        onSendText={function handleSendText(text: string): void {
          sendText.mutate({ text });
        }}
        onSendImages={function handleSendImages(files: File[]): void {
          sendImages.mutate({ files });
        }}
        onSendPriceOffer={function handleSendOffer(amount: number): void {
          sendOffer.mutate({ amount });
        }}
      />
    </main>
  );
}

export default ChatRoomPage;
