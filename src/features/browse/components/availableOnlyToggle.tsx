import type { ChangeEvent } from 'react';

type AvailableOnlyToggleProps = {
  checked: boolean;
  onChange(checked: boolean): void;
};

const TOGGLE_ID = 'filterAvailableOnly';

/** 판매완료만 숨긴다. 예약중은 아직 거래가 틀어질 수 있어 남긴다. */
function AvailableOnlyToggle(props: AvailableOnlyToggleProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    props.onChange(event.target.checked);
  }

  return (
    <label
      htmlFor={TOGGLE_ID}
      className="flex cursor-pointer items-center justify-between gap-3 text-sm
                 font-medium text-gray-700 dark:text-gray-200"
    >
      <span className="flex flex-col">
        거래 가능만 보기
        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
          거래완료된 물건을 숨깁니다.
        </span>
      </span>
      <input
        id={TOGGLE_ID}
        name={TOGGLE_ID}
        type="checkbox"
        checked={props.checked}
        onChange={handleChange}
        className="h-5 w-5 shrink-0 accent-emerald-600"
      />
    </label>
  );
}

export default AvailableOnlyToggle;
