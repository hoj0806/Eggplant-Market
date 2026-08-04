import { useState, type FormEvent } from 'react';
import { formatPrice } from '../../../shared/utils/formatPrice';
import { validateOfferAmount } from '../utils/validateChatInput';

type PriceOfferFormProps = {
  /** 지금 붙어 있는 판매가. 얼마를 부를지 정하는 기준이라 곁에 적어 준다. */
  postPrice: number;
  isSending: boolean;
  /** 아직 답을 못 받은 내 제안이 있으면 새로 보내지 않는다. */
  hasPendingOffer: boolean;
  onSubmit(amount: number): void;
  onCancel(): void;
};

const AMOUNT_INPUT_ID = 'priceOfferAmount';

/**
 * 가격 제안 입력.
 *
 * 입력줄(`chatComposer`) 위에 열린다. 폼을 따로 둔 이유는 Enter다 — 대화 입력에서 Enter는
 * 전송인데, 같은 폼 안에 두면 금액을 치다 Enter를 눌렀을 때 어느 쪽이 나갈지 알 수 없다.
 *
 * 보낸 뒤 입력을 비우거나 패널을 닫는 일은 부모가 한다. 성공 여부를 아는 쪽이 부모이기 때문이다.
 */
function PriceOfferForm(props: PriceOfferFormProps) {
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const message = validateOfferAmount(amount);
    if (message !== undefined) {
      setErrorMessage(message);
      return;
    }

    setErrorMessage(undefined);
    props.onSubmit(Number(amount.trim()));
  }

  // 답을 기다리는 제안이 있으면 금액 칸을 아예 열지 않는다. 잠긴 버튼을 보여 주고
  // 이유를 짐작하게 하는 대신, 눌러서 연 자리에 이유를 적는다.
  if (props.hasPendingOffer) {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-xl border border-amber-200
                   bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950"
      >
        <p role="status" className="text-xs text-amber-900 dark:text-amber-100">
          먼저 보낸 제안의 답을 기다리는 중입니다.
        </p>
        <button
          type="button"
          onClick={props.onCancel}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-amber-900 transition
                     hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900"
        >
          닫기
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="가격 제안"
      className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3
                 dark:border-amber-900 dark:bg-amber-950"
    >
      <div className="flex items-center justify-between">
        <label
          htmlFor={AMOUNT_INPUT_ID}
          className="text-xs font-semibold text-amber-900 dark:text-amber-100"
        >
          얼마에 거래하고 싶으세요?
        </label>
        <span className="text-xs text-amber-800 dark:text-amber-200">
          판매가 {formatPrice(props.postPrice)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          id={AMOUNT_INPUT_ID}
          name={AMOUNT_INPUT_ID}
          type="text"
          inputMode="numeric"
          value={amount}
          placeholder="숫자만 입력"
          onChange={function handleAmountChange(event): void {
            setAmount(event.target.value);
          }}
          className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm
                     text-gray-900 outline-none transition focus:border-amber-500
                     dark:border-amber-800 dark:bg-gray-900 dark:text-gray-50"
        />
        <span className="text-sm text-amber-900 dark:text-amber-100">원</span>

        {/*
          입력줄의 전송 버튼과 달리 "형식이 틀렸다"는 이유로는 잠그지 않는다.
          잠긴 버튼은 이유를 말해 주지 않는다 — `3만원`이라고 친 사람은 왜 안 눌리는지 모른다.
          비었을 때만 잠그고, 나머지는 눌러서 문구를 보게 한다.
        */}
        <button
          type="submit"
          disabled={props.isSending || amount.trim().length === 0}
          className="h-10 shrink-0 rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white
                     transition hover:bg-amber-700 disabled:opacity-50"
        >
          제안
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="h-10 shrink-0 rounded-lg px-2 text-sm text-amber-900 transition
                     hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900"
        >
          취소
        </button>
      </div>

      {errorMessage === undefined ? null : (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </form>
  );
}

export default PriceOfferForm;
