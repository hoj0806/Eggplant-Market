import type { Region } from '../types';

type RegionResultListProps = {
  regions: ReadonlyArray<Region>;
  selectedCode: string | null;
  disabled: boolean;
  onSelect(region: Region): void;
};

const ITEM_BASE_CLASS =
  'w-full rounded-lg px-3 py-2.5 text-left text-sm transition ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

function RegionResultList(props: RegionResultListProps) {
  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto" aria-label="동네 검색 결과">
      {props.regions.map(function renderRegionRow(region: Region) {
        const isSelected = region.code === props.selectedCode;

        return (
          <li key={region.code}>
            <button
              type="button"
              disabled={props.disabled}
              aria-pressed={isSelected}
              onClick={function handleSelect(): void {
                props.onSelect(region);
              }}
              className={`${ITEM_BASE_CLASS} ${
                isSelected
                  ? 'bg-emerald-600 font-semibold text-white'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              {region.fullName}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default RegionResultList;
