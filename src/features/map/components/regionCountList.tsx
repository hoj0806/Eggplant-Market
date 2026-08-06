import { formatDistance } from '../../../shared/utils/formatDistance';
import type { RegionPostCount } from '../types';

type RegionCountListProps = {
  regions: ReadonlyArray<RegionPostCount>;
  selectedRegionCode: string | null;
  onSelect(regionCode: string): void;
};

const ITEM_CLASS =
  'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left ' +
  'text-sm transition';

const SELECTED_CLASS =
  'border-emerald-600 bg-emerald-50 text-emerald-900 ' +
  'dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-100';

const UNSELECTED_CLASS =
  'border-gray-200 bg-white text-gray-800 hover:bg-gray-50 ' +
  'dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900';

/**
 * 마커와 같은 것을 글로 적은 줄.
 *
 * 지도가 있는데 목록을 또 두는 이유는 **지도만으로는 닿을 수 없는 마커가 생기기 때문**이다 —
 * 마커 둘이 겹치면 뒤엣것을 누를 방법이 없고, 확대해서 떼어 놓는 것은 화면이 좁을수록 어렵다.
 * 지도를 못 쓰는 상황(SDK 실패)에서도 이 줄은 그대로 남는다.
 *
 * 거리를 적는다. 마커에는 자리가 없어 이름과 개수만 들어가는데, "가까운 순으로 놓였다"는
 * 사실은 숫자가 보여야 확인된다.
 */
function RegionCountList(props: RegionCountListProps) {
  function toClickHandler(regionCode: string) {
    return function handleClick(): void {
      props.onSelect(regionCode);
    };
  }

  if (props.regions.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {props.regions.map(function toItem(region: RegionPostCount) {
        const isSelected = region.regionCode === props.selectedRegionCode;

        return (
          <li key={region.regionCode}>
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={toClickHandler(region.regionCode)}
              className={`${ITEM_CLASS} ${isSelected ? SELECTED_CLASS : UNSELECTED_CLASS}`}
            >
              <span className="min-w-0 truncate font-semibold">{region.dongName}</span>
              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {formatDistance(region.distanceM)} · {region.postCount}건
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default RegionCountList;
