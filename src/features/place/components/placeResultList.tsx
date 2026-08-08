import type { TradePlace } from '../types';

type PlaceResultListProps = {
  places: ReadonlyArray<TradePlace>;
  selectedId: string | null;
  disabled: boolean;
  onSelect(place: TradePlace): void;
};

const ITEM_BASE_CLASS =
  'w-full rounded-lg px-3 py-2.5 text-left text-sm transition ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

/** 같은 이름의 가게가 여럿이라 주소를 함께 보여줘야 고를 수 있다. */
function PlaceResultList(props: PlaceResultListProps) {
  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto" aria-label="장소 검색 결과">
      {props.places.map(function renderPlaceRow(place: TradePlace) {
        const isSelected = place.id === props.selectedId;

        return (
          <li key={place.id}>
            <button
              type="button"
              disabled={props.disabled}
              aria-pressed={isSelected}
              onClick={function handleSelect(): void {
                props.onSelect(place);
              }}
              className={`${ITEM_BASE_CLASS} ${
                isSelected
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              <span className="block font-medium">{place.name}</span>
              <span className={`block text-xs ${isSelected ? 'opacity-90' : 'opacity-70'}`}>
                {place.addressName}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default PlaceResultList;
