import { useState } from 'react';
import CurrentLocationButton from './currentLocationButton';
import RegionResultList from './regionResultList';
import RegionSearchField from './regionSearchField';
import SelectedRegionBadge from './selectedRegionBadge';
import { useCurrentRegionMutation } from '../hooks/useCurrentRegionMutation';
import { MIN_REGION_QUERY_LENGTH, useRegionSearch } from '../hooks/useRegionSearch';
import { toRegionErrorMessage } from '../utils/regionErrorMessage';
import type { Region } from '../types';

type RegionPickerProps = {
  value: Region | null;
  disabled?: boolean;
  /** 부모가 붙이는 검증 문구(예: 동네를 고르지 않고 제출한 경우). */
  errorMessage?: string;
  onChange(region: Region): void;
};

/**
 * 동네를 고르는 공용 위젯. 온보딩 2단계와 동네 변경 화면이 같이 쓴다.
 *
 * 저장은 하지 않는다 — 어디에 어떻게 저장할지는 화면마다 다르므로 부모의 몫이다.
 * 덕분에 이 컴포넌트는 Supabase를 전혀 모르고, 테스트할 때도 카카오 호출만 갈아끼우면 된다.
 */
function RegionPicker(props: RegionPickerProps) {
  const [query, setQuery] = useState('');
  const searchQuery = useRegionSearch(query);
  const locateMutation = useCurrentRegionMutation();

  const isDisabled = props.disabled === true;
  const regions = searchQuery.data ?? [];
  const hasEnoughQuery = query.trim().length >= MIN_REGION_QUERY_LENGTH;

  function handleLocate(): void {
    locateMutation.mutate(undefined, {
      onSuccess: function applyLocatedRegion(region: Region): void {
        props.onChange(region);
      },
    });
  }

  // 위치 실패가 검색 실패보다 먼저다 — 방금 누른 버튼의 결과를 먼저 알려 줘야 한다.
  function toFailureMessage(): string | null {
    if (locateMutation.error !== null) {
      return toRegionErrorMessage(locateMutation.error);
    }
    if (searchQuery.error !== null && searchQuery.error !== undefined) {
      return toRegionErrorMessage(searchQuery.error);
    }
    return props.errorMessage ?? null;
  }

  const failureMessage = toFailureMessage();

  return (
    <div className="flex flex-col gap-4">
      <CurrentLocationButton
        isPending={locateMutation.isPending}
        disabled={isDisabled}
        onClick={handleLocate}
      />

      <RegionSearchField value={query} disabled={isDisabled} onValueChange={setQuery} />

      {failureMessage !== null ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700
                     dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          {failureMessage}
        </p>
      ) : null}

      {searchQuery.isFetching ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">동네를 찾는 중입니다…</p>
      ) : null}

      {!searchQuery.isFetching && hasEnoughQuery && regions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          검색 결과가 없습니다. 다른 이름으로 찾아보세요.
        </p>
      ) : null}

      {regions.length > 0 ? (
        <RegionResultList
          regions={regions}
          selectedCode={props.value?.code ?? null}
          disabled={isDisabled}
          onSelect={props.onChange}
        />
      ) : null}

      {props.value !== null ? (
        <SelectedRegionBadge region={props.value} label="선택한 동네" />
      ) : null}
    </div>
  );
}

export default RegionPicker;
