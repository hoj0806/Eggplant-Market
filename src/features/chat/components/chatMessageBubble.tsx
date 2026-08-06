import ChatImageMessage from './chatImageMessage';
import { formatPrice } from '../../../shared/utils/formatPrice';
import { canCancelOffer, canRespondToOffer, OFFER_STATUS_LABEL } from '../utils/priceOffer';
import type { ChatMessage, OfferResponse } from '../types';

type ChatMessageBubbleProps = {
  message: ChatMessage;
  /** 내가 보낸 메시지면 오른쪽에 붙고 "안읽음"을 함께 보여준다. */
  isMine: boolean;
  /** 수락·거절 요청이 도는 중. 답이 오기 전에 두 번 눌리지 않게 잠근다. */
  isRespondingToOffer: boolean;
  /**
   * 취소 요청이 도는 중. 수락·거절과 따로 받는 이유는 **누르는 사람이 다르기 때문**이다 —
   * 하나로 묶으면 상대가 수락을 누르는 동안 내 취소 버튼도 함께 잠긴다.
   */
  isCancellingOffer: boolean;
  onRespondToOffer(messageId: number, status: OfferResponse): void;
  onCancelOffer(messageId: number): void;
};

const TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  hour: 'numeric',
  minute: '2-digit',
});

const OFFER_BUTTON_CLASS = 'rounded-lg px-3 py-1 text-xs font-semibold transition disabled:opacity-50';

function toTimeText(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : TIME_FORMATTER.format(date);
}

/**
 * 가격 제안 말풍선.
 *
 * 받은 쪽에는 수락·거절 버튼이, 보낸 쪽에는 기다린다는 말과 **취소 버튼**이 붙는다.
 * 답이 끝나면 양쪽 모두 결과만 남는다 — 되돌리는 길은 없고, 마음이 바뀌면 새로 제안한다.
 * 취소도 답의 하나다. 말풍선은 사라지지 않고 "취소됨"으로 남는다(0027).
 *
 * 수락해도 게시물 가격은 그대로다. 당근에서도 제안 수락은 "그 값에 하자"는 합의 표시일 뿐,
 * 판매글의 가격표를 바꾸는 일이 아니다.
 */
function PriceOfferBody(props: ChatMessageBubbleProps) {
  const message = props.message;
  const status = message.offerStatus;

  return (
    <div
      className="flex flex-col gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2
                 dark:border-amber-900 dark:bg-amber-950"
    >
      <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">가격 제안</span>
      <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
        {formatPrice(message.offerAmount ?? 0)}
      </span>

      {canRespondToOffer(message, props.isMine) ? (
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={props.isRespondingToOffer}
            onClick={function accept(): void {
              props.onRespondToOffer(message.id, 'accepted');
            }}
            className={`${OFFER_BUTTON_CLASS} bg-amber-600 text-white hover:bg-amber-700`}
          >
            수락
          </button>
          <button
            type="button"
            disabled={props.isRespondingToOffer}
            onClick={function reject(): void {
              props.onRespondToOffer(message.id, 'rejected');
            }}
            className={`${OFFER_BUTTON_CLASS} border border-amber-300 text-amber-800
                        hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900`}
          >
            거절
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-amber-800 dark:text-amber-200">
            {status === null ? OFFER_STATUS_LABEL.pending : OFFER_STATUS_LABEL[status]}
          </span>

          {/*
            "답변 대기 중" 옆에 붙는다. 답이 오면 이 버튼은 사라지고 결과만 남는다.
            수락·거절처럼 눈에 띄게 만들지 않은 이유는 이것이 **되돌리는 버튼**이라서다 —
            제안을 보낸 사람이 찾을 때만 보이면 된다.
          */}
          {canCancelOffer(message, props.isMine) ? (
            <button
              type="button"
              disabled={props.isCancellingOffer}
              onClick={function cancel(): void {
                props.onCancelOffer(message.id);
              }}
              className={`${OFFER_BUTTON_CLASS} text-amber-800 underline
                          hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100`}
            >
              제안 취소
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MessageBody(props: ChatMessageBubbleProps) {
  const message = props.message;

  if (message.type === 'image') {
    return <ChatImageMessage path={message.content} />;
  }

  if (message.type === 'price_offer') {
    return <PriceOfferBody {...props} />;
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
        <MessageBody {...props} />
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
