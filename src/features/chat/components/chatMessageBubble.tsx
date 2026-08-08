import { useState } from 'react';
import ChatImageMessage from './chatImageMessage';
import { formatPrice } from '../../../shared/utils/formatPrice';
import { canDeleteMessage, DELETED_MESSAGE_TEXT, isDeletedMessage } from '../utils/messageDelete';
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
  /** 삭제 요청이 도는 중. 이것도 따로다 — 지우는 사람은 언제나 보낸 쪽이다. */
  isDeletingMessage: boolean;
  onRespondToOffer(messageId: number, status: OfferResponse): void;
  onCancelOffer(messageId: number): void;
  /** 사진 메시지면 경로를 함께 넘긴다. 서버가 content를 비우고 나면 알 길이 없다. */
  onDeleteMessage(messageId: number, imagePath?: string): void;
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

/**
 * 지운 말풍선.
 *
 * 자리를 비우지 않는다. 말이 오갔다는 사실은 남기기로 한 결정(0029)이 화면에서도 같은
 * 모양이어야, 상대가 "무슨 말을 하다 말았나"를 알 수 있다. 양쪽에 똑같이 보인다 —
 * 지운 사람에게만 남기면 상대 화면에는 대화가 그냥 사라진 것으로 보인다.
 *
 * 글·사진을 가리지 않고 한 모양이다. 지운 뒤에는 무엇이었는지가 남지 않고,
 * 남길 이유도 없다("사진을 지웠습니다"는 지우려던 것을 절반 알려 준다).
 */
function DeletedBody() {
  return (
    <span className="italic text-gray-500 dark:text-gray-400">{DELETED_MESSAGE_TEXT}</span>
  );
}

/**
 * 내 말풍선 옆의 "삭제".
 *
 * 한 번 더 묻는다 — 되돌릴 수 없고(0029), 말풍선이 촘촘히 붙어 있어 잘못 누르기 쉽다.
 * 댓글 삭제(commentListItem)와 같은 형태로, 새 창을 띄우지 않고 그 자리에서 묻는다.
 *
 * 시각 아래에 작게 둔다. 대화 중에 늘 보일 필요가 없는 버튼이고, 눈에 띄게 만들면
 * 말풍선마다 붉은 글자가 따라다닌다.
 */
function DeleteControl(props: {
  isDeleting: boolean;
  onDelete(): void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={function askDelete(): void {
          setIsConfirming(true);
        }}
        className="text-[10px] text-gray-400 transition hover:text-gray-600
                   dark:text-gray-500 dark:hover:text-gray-300"
      >
        삭제
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        disabled={props.isDeleting}
        onClick={props.onDelete}
        className="text-[10px] font-semibold text-red-600 transition hover:text-red-700
                   disabled:opacity-60 dark:text-red-400"
      >
        {props.isDeleting ? '지우는 중…' : '지울까요?'}
      </button>
      <button
        type="button"
        onClick={function cancelDelete(): void {
          setIsConfirming(false);
        }}
        className="text-[10px] text-gray-400 transition hover:text-gray-600
                   dark:text-gray-500 dark:hover:text-gray-300"
      >
        취소
      </button>
    </span>
  );
}

function ChatMessageBubble(props: ChatMessageBubbleProps) {
  const message = props.message;
  const isDeleted = isDeletedMessage(message);
  // 지운 말풍선은 사진이었든 제안이었든 글 한 줄이라, 글 말풍선의 껍데기를 쓴다.
  const hasTextShell = message.type === 'text' || isDeleted;

  function handleDelete(): void {
    props.onDeleteMessage(
      message.id,
      message.type === 'image' && message.content !== null ? message.content : undefined,
    );
  }

  return (
    <li className={`flex items-end gap-1.5 ${props.isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={
          hasTextShell
            ? `max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                isDeleted
                  ? 'border border-dashed border-gray-300 dark:border-gray-700'
                  : props.isMine
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50'
              }`
            : 'max-w-[75%]'
        }
      >
        {isDeleted ? <DeletedBody /> : <MessageBody {...props} />}
      </div>

      <div className="flex flex-col items-end">
        {/*
          상대가 아직 안 읽었다는 표시. 내가 보낸 것에만 뜬다.
          지운 뒤에는 뜨지 않는다 — 읽을 것이 없어진 줄이라 서버도 안 읽은 수에서 뺀다(0029).
        */}
        {props.isMine && !isDeleted && message.readAt === null ? (
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            안읽음
          </span>
        ) : null}
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {toTimeText(message.createdAt)}
        </span>
        {canDeleteMessage(message, props.isMine) ? (
          <DeleteControl isDeleting={props.isDeletingMessage} onDelete={handleDelete} />
        ) : null}
      </div>
    </li>
  );
}

export default ChatMessageBubble;
