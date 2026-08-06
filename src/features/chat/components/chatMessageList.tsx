import { useEffect, useRef } from 'react';
import ChatMessageBubble from './chatMessageBubble';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import type { ChatMessage, OfferResponse } from '../types';

type ChatMessageListProps = {
  messages: ChatMessage[];
  viewerId: string;
  isLoading: boolean;
  isError: boolean;
  /** 위로 더 거슬러 올라갈 대화가 있는가. */
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** 제안 답변이 도는 중. 말풍선의 수락·거절 버튼을 함께 잠근다. */
  isRespondingToOffer: boolean;
  /** 제안 취소가 도는 중. 답변과 따로인 이유는 누르는 사람이 다르기 때문이다. */
  isCancellingOffer: boolean;
  /** 메시지 삭제가 도는 중. 같은 이유로 또 따로다. */
  isDeletingMessage: boolean;
  onLoadMore(): void;
  onRespondToOffer(messageId: number, status: OfferResponse): void;
  onCancelOffer(messageId: number): void;
  onDeleteMessage(messageId: number, imagePath?: string): void;
};

const MESSAGE_CLASS = 'py-8 text-center text-sm text-gray-500 dark:text-gray-400';

/**
 * 대화 내용.
 *
 * 목록은 오래된 것이 위, 새 것이 아래다. 그래서 "다음 페이지"를 부르는 표식이
 * 게시물 목록과 달리 **맨 위**에 있다. 위로 스크롤하면 이전 대화가 이어 붙는다.
 *
 * 새 메시지가 오면 맨 아래로 내린다. 대화 화면은 마지막 줄이 보이는 것이 기본 상태다.
 */
function ChatMessageList(props: ChatMessageListProps) {
  const sentinelRef = useInfiniteScroll({
    hasNextPage: props.hasNextPage,
    isFetching: props.isFetchingNextPage,
    onLoadMore: props.onLoadMore,
  });

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMessageId = props.messages.length === 0 ? null : props.messages[props.messages.length - 1].id;

  useEffect(
    function scrollToLatest(): void {
      // 위로 더 읽어 올 때는 내리지 않는다. 마지막 메시지가 바뀌었을 때만 움직인다.
      bottomRef.current?.scrollIntoView({ block: 'end' });
    },
    [lastMessageId],
  );

  if (props.isLoading) {
    return <p className={MESSAGE_CLASS}>대화를 불러오는 중입니다…</p>;
  }

  if (props.isError) {
    return (
      <p role="alert" className="py-8 text-center text-sm text-red-600 dark:text-red-400">
        대화를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-end gap-2">
      <ul className="flex flex-col gap-2">
        {/* 이전 대화를 부르는 표식. 목록의 일부가 아니라 관찰 대상일 뿐이다. */}
        <li ref={sentinelRef} aria-hidden="true" className="h-px" />

        {props.isFetchingNextPage ? (
          <li className={MESSAGE_CLASS}>이전 대화를 불러오는 중입니다…</li>
        ) : null}

        {props.messages.length === 0 ? (
          <li className={MESSAGE_CLASS}>먼저 인사를 건네 보세요.</li>
        ) : null}

        {props.messages.map(function renderBubble(message: ChatMessage) {
          return (
            <ChatMessageBubble
              key={message.id}
              message={message}
              isMine={message.senderId === props.viewerId}
              isRespondingToOffer={props.isRespondingToOffer}
              isCancellingOffer={props.isCancellingOffer}
              isDeletingMessage={props.isDeletingMessage}
              onRespondToOffer={props.onRespondToOffer}
              onCancelOffer={props.onCancelOffer}
              onDeleteMessage={props.onDeleteMessage}
            />
          );
        })}
      </ul>

      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}

export default ChatMessageList;
