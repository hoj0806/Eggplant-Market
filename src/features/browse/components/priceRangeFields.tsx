import type { ChangeEvent } from 'react';

type PriceRangeFieldsProps = {
  /** 입력 중인 값이라 아직 문자열이다. 비우려면 빈 문자열. */
  minPriceText: string;
  maxPriceText: string;
  errorMessage: string | null;
  onMinPriceChange(value: string): void;
  onMaxPriceChange(value: string): void;
};

const MIN_ID = 'filterMinPrice';
const MAX_ID = 'filterMaxPrice';
const ERROR_ID = 'filter-price-error';

const INPUT_CLASS =
  'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition ' +
  'bg-white text-gray-900 placeholder:text-gray-400 ' +
  'focus:ring-2 focus:ring-emerald-500/40 ' +
  'dark:bg-gray-900 dark:text-gray-50 dark:placeholder:text-gray-500';

/**
 * "xxx원 이상 ~ xxx원 이하" 가격 구간.
 *
 * `type="number"`를 쓰지 않는다 — 모바일에서 스크롤로 값이 바뀌고, 사용자가 지운 상태를
 * 브라우저마다 다르게 돌려준다. 숫자 키패드만 띄우고 검증은 우리가 한다.
 */
function PriceRangeFields(props: PriceRangeFieldsProps) {
  const hasError = props.errorMessage !== null;
  const borderClass = hasError
    ? 'border-red-500 focus:ring-red-500/40'
    : 'border-gray-300 dark:border-gray-700';

  function handleMinChange(event: ChangeEvent<HTMLInputElement>): void {
    props.onMinPriceChange(event.target.value);
  }

  function handleMaxChange(event: ChangeEvent<HTMLInputElement>): void {
    props.onMaxPriceChange(event.target.value);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">가격</span>

      <div className="flex items-center gap-2">
        <input
          id={MIN_ID}
          name={MIN_ID}
          type="text"
          inputMode="numeric"
          aria-label="최소 가격"
          aria-invalid={hasError}
          aria-describedby={hasError ? ERROR_ID : undefined}
          placeholder="0"
          value={props.minPriceText}
          onChange={handleMinChange}
          className={`${INPUT_CLASS} ${borderClass}`}
        />
        <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">원 이상 ~</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          id={MAX_ID}
          name={MAX_ID}
          type="text"
          inputMode="numeric"
          aria-label="최대 가격"
          aria-invalid={hasError}
          aria-describedby={hasError ? ERROR_ID : undefined}
          placeholder="제한 없음"
          value={props.maxPriceText}
          onChange={handleMaxChange}
          className={`${INPUT_CLASS} ${borderClass}`}
        />
        <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">원 이하</span>
      </div>

      {hasError ? (
        <p id={ERROR_ID} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {props.errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export default PriceRangeFields;
