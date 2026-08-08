import {
  SEARCH_RADIUS_OPTIONS,
  toSearchRadiusLabel,
} from '../../browse/utils/searchRadius';

type SearchRadiusSelectProps = {
  value: number;
  disabled: boolean;
  onChange(radiusM: number): void;
};

const BASE_CLASS =
  'rounded-full border px-3 py-1.5 text-sm font-semibold transition ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const SELECTED_CLASS =
  'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 ' +
  'dark:border-emerald-500 dark:bg-emerald-600';

const UNSELECTED_CLASS =
  'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 ' +
  'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';

/**
 * 검색 반경 고르기.
 *
 * 정렬(`postSortSelect`)과 달리 select가 아니라 칩이다. 다섯 개뿐이라 한 줄에 들어가고,
 * **지금 고른 것과 고를 수 있는 것이 함께 보여야** 하기 때문이다 — 반경은 "2km가 얼마나
 * 넓은지" 감이 없는 값이라, 접힌 목록에서는 옆 칸과 견줄 수가 없다.
 *
 * 고르는 즉시 저장한다. "적용" 버튼을 두면 동네 변경 버튼과 나란히 놓여 어느 쪽이 무엇을
 * 저장하는지 흐려진다.
 */
function SearchRadiusSelect(props: SearchRadiusSelectProps) {
  function toClickHandler(radiusM: number) {
    return function handleClick(): void {
      if (radiusM !== props.value) {
        props.onChange(radiusM);
      }
    };
  }

  return (
    <div role="group" aria-label="검색 반경" className="flex flex-wrap gap-2">
      {SEARCH_RADIUS_OPTIONS.map(function toChip(radiusM: number) {
        const isSelected = radiusM === props.value;

        return (
          <button
            key={radiusM}
            type="button"
            // 라디오 한 벌이라는 것을 보조기기에도 알린다. 칩은 보기에만 라디오다.
            aria-pressed={isSelected}
            disabled={props.disabled}
            onClick={toClickHandler(radiusM)}
            className={`${BASE_CLASS} ${isSelected ? SELECTED_CLASS : UNSELECTED_CLASS}`}
          >
            {toSearchRadiusLabel(radiusM)}
          </button>
        );
      })}
    </div>
  );
}

export default SearchRadiusSelect;
