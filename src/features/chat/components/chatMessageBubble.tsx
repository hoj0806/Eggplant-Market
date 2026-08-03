import ChatImageMessage from './chatImageMessage';
import { formatPrice } from '../../../shared/utils/formatPrice';
import type { ChatMessage } from '../types';

type ChatMessageBubbleProps = {
  message: ChatMessage;
  /** 내가 보낸 메시지면 오른쪽에 붙고 "안읽음"을 함께 보여준다. */
  isMine: boolean;
};

const TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  hour: 'numeric',
  minute: '2-digit',
});

function toTimeText(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : TIME_FORMATTER.format(date);
}

function MessageBody(props: { message: ChatMessage }) {
  const message = props.message;

  if (message.type === 'image') {
    return <ChatImageMessage path={message.content} />;
  }

  // 가격 제안은 아직 보내는 화면이 없다. 다음 작업에서 수락·거절 버튼이 붙는 자리다.
  if (message.type === 'price_offer') {
    return (
      <span className="rounded-2xl bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900 dark:text-amber-100">
        {formatPrice(message.offerAmount ?? 0)} 제안
      </span>
    );
  }

  return <span className="whitespace-pre-wrap break-words">{message.content}</span>;
}

function ChatMessageBubble(props: ChatMessageBubbleProps) {
  const message = props.message;
  const isPlainText = message.type === 'text';

  return (
    <li className={`flex items-end gap-1.5 ${props.isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={
          isPlainText
            ? `max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                props.isMine
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50'
              }`
            : 'max-w-[75%]'
        }
      >
        <MessageBody message={message} />
      </div>

      <div className="flex flex-col items-end">
        {/* 상대가 아직 안 읽었다는 표시. 내가 보낸 것에만 뜬다. */}
        {props.isMine && message.readAt === null ? (
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            안읽음
          </span>
        ) : null}
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {toTimeText(message.createdAt)}
        </span>
      </div>
    </li>
  );
}

export default ChatMessageBubble;
