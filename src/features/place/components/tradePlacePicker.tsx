import { useState } from 'react';
import PlaceResultList from './placeResultList';
import SelectedPlaceBadge from './selectedPlaceBadge';
import TextField from '../../../shared/ui/textField';
import { toRegionErrorMessage } from '../../region/utils/regionErrorMessage';
import { MIN_PLACE_QUERY_LENGTH, usePlaceSearch } from '../hooks/usePlaceSearch';
import type { RegionCoords } from '../../region/types';
import type { TradePlace } from '../types';

type TradePlacePickerProps = {
  value: TradePlace | null;
  /** 검색 중심으로 쓸 사용자 동네 좌표. 모르면 null(전국 검색으로 물러선다). */
  center: RegionCoords | null;
  disabled?: boolean;
  onChange(place: TradePlace | null): void;
};

/**
 * 거래희망장소를 고르는 위젯. 지도는 띄우지 않고 이름으로 찾아 목록에서 고른다.
 *
 * 저장은 하지 않는다 — RegionPicker와 같은 이유로, 어디에 저장할지는 부모의 몫이다.
 * 선택 사항이라 검증 문구도 받지 않는다. 비워 두는 것이 정상적인 선택지다.
 */
function TradePlacePicker(props: TradePlacePickerProps) {
  const [query, setQuery] = useState('');
  const searchQuery = usePlaceSearch(query, props.center);

  const isDisabled = props.disabled === true;
  const places = searchQuery.data ?? [];
  const hasEnoughQuery = query.trim().length >= MIN_PLACE_QUERY_LENGTH;

  function handleSelect(place: TradePlace): void {
    props.onChange(place);
  }

  function handleClear(): void {
    props.onChange(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <TextField
        id="tradePlaceQuery"
        label="거래희망장소 (선택)"
        value={query}
        placeholder="예: 수유역 4번출구"
        description={`장소 이름을 ${MIN_PLACE_QUERY_LENGTH}자 이상 입력하면 내 동네 주변에서 찾습니다.`}
        autoComplete="off"
        disabled={isDisabled}
        onValueChange={setQuery}
      />

      {searchQuery.error !== null && searchQuery.error !== undefined ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700
                     dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          {toRegionErrorMessage(searchQuery.error)}
        </p>
      ) : null}

      {searchQuery.isFetching ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">장소를 찾는 중입니다…</p>
      ) : null}

      {!searchQuery.isFetching && hasEnoughQuery && places.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          검색 결과가 없습니다. 다른 이름으로 찾아보세요.
        </p>
      ) : null}

      {places.length > 0 ? (
        <PlaceResultList
          places={places}
          selectedId={props.value?.id ?? null}
          disabled={isDisabled}
          onSelect={handleSelect}
        />
      ) : null}

      {props.value !== null ? (
        <SelectedPlaceBadge place={props.value} disabled={isDisabled} onClear={handleClear} />
      ) : null}
    </div>
  );
}

export default TradePlacePicker;
