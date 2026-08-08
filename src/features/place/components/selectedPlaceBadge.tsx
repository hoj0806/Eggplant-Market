import type { TradePlace } from '../types';

type SelectedPlaceBadgeProps = {
  place: TradePlace;
  disabled: boolean;
  onClear(): void;
};

/** 거래희망장소는 선택 사항이라 고른 뒤 되돌릴 수단이 있어야 한다. */
function SelectedPlaceBadge(props: SelectedPlaceBadgeProps) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200
                 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-900
                 dark:bg-emerald-950 dark:text-emerald-200"
    >
      <span className="flex flex-col">
        <span className="font-semibold">{props.place.name}</span>
        <span className="text-xs opacity-80">{props.place.addressName}</span>
      </span>
      <button
        type="button"
        disabled={props.disabled}
        onClick={props.onClear}
        aria-label="거래희망장소 선택 해제"
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium transition
                   hover:bg-emerald-100 disabled:opacity-60 dark:hover:bg-emerald-900"
      >
        선택 해제
      </button>
    </div>
  );
}

export default SelectedPlaceBadge;
