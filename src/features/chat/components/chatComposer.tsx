import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import PriceOfferForm from './priceOfferForm';
import {
  ALLOWED_CHAT_IMAGE_TYPES,
  canSendMessageText,
  validateChatImages,
  validateMessageText,
} from '../utils/validateChatInput';

type ChatComposerProps = {
  isSending: boolean;
  /** 가격 제안 버튼을 열지. 사는 쪽이고 판매중일 때만 참이다(canSendPriceOffer). */
  canOfferPrice: boolean;
  /** 제안 패널에 적어 주는 현재 판매가. */
  postPrice: number;
  hasPendingOffer: boolean;
  onSendText(text: string): void;
  onSendImages(files: File[]): void;
  onSendPriceOffer(amount: number): void;
};

const FILE_INPUT_ID = 'chatImages';

/**
 * 메시지 입력줄.
 *
 * 보낸 뒤 서버 응답을 기다리지 않고 입력을 비운다. 대화는 리듬이 있어서
 * 왕복을 기다리는 동안 글자가 남아 있으면 두 번 보낸 것처럼 느껴진다.
 * 실패하면 부모가 오류 문구를 띄운다.
 *
 * Enter는 전송, Shift+Enter는 줄바꿈이다.
 */
function ChatComposer(props: ChatComposerProps) {
  const [text, setText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isOfferOpen, setIsOfferOpen] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const message = validateMessageText(text);
    if (message !== undefined) {
      setErrorMessage(message);
      return;
    }

    setErrorMessage(undefined);
    setText('');
    props.onSendText(text.trim());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const selected = Array.from(event.target.files ?? []);
    // 같은 파일을 다시 골라도 change가 일어나도록 입력값을 비운다.
    event.target.value = '';

    if (selected.length === 0) {
      return;
    }

    const message = validateChatImages(selected);
    if (message !== undefined) {
      setErrorMessage(message);
      return;
    }

    setErrorMessage(undefined);
    props.onSendImages(selected);
  }

  function handleSendOffer(amount: number): void {
    // 글·사진과 같다. 보낸 뒤 응답을 기다리지 않고 자리를 정리한다.
    setIsOfferOpen(false);
    props.onSendPriceOffer(amount);
  }

  return (
    <div className="flex flex-col gap-2 border-t border-gray-200 bg-white pt-3 dark:border-gray-800 dark:bg-gray-950">
      {props.canOfferPrice && isOfferOpen ? (
        <PriceOfferForm
          postPrice={props.postPrice}
          isSending={props.isSending}
          hasPendingOffer={props.hasPendingOffer}
          onSubmit={handleSendOffer}
          onCancel={function closeOffer(): void {
            setIsOfferOpen(false);
          }}
        />
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-1">
        <div className="flex items-end gap-2">
          <label
            htmlFor={FILE_INPUT_ID}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg
                       border border-gray-300 text-lg text-gray-500 transition hover:bg-gray-50
                       dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            ＋
          </label>
          <input
            id={FILE_INPUT_ID}
            name={FILE_INPUT_ID}
            type="file"
            multiple
            accept={ALLOWED_CHAT_IMAGE_TYPES.join(',')}
            disabled={props.isSending}
            aria-label="사진 보내기"
            onChange={handleFileChange}
            className="sr-only"
          />

          {/* 사는 쪽에만 보인다. 파는 쪽은 게시물 가격을 직접 고치면 되므로 제안할 일이 없다. */}
          {props.canOfferPrice ? (
            <button
              type="button"
              aria-label="가격 제안"
              aria-expanded={isOfferOpen}
              onClick={function toggleOffer(): void {
                setIsOfferOpen(!isOfferOpen);
              }}
              className="h-10 w-10 shrink-0 rounded-lg border border-amber-300 text-sm font-semibold
                         text-amber-700 transition hover:bg-amber-50
                         dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
            >
              ₩
            </button>
          ) : null}

          <textarea
            rows={1}
            value={text}
            aria-label="메시지 입력"
            placeholder="메시지를 입력하세요"
            onChange={function handleTextChange(event): void {
              setText(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2
                       text-sm text-gray-900 outline-none transition focus:border-emerald-500
                       dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
          />

          <button
            type="submit"
            disabled={props.isSending || !canSendMessageText(text)}
            className="h-10 shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white
                       transition hover:bg-emerald-700 disabled:opacity-50"
          >
            전송
          </button>
        </div>

        {errorMessage === undefined ? null : (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        )}
      </form>
    </div>
  );
}

export default ChatComposer;
