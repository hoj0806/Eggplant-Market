import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { searchRegionsByKeyword } from '../api/regionApi';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import type { Region } from '../types';

export const MIN_REGION_QUERY_LENGTH = 2;

const SEARCH_DEBOUNCE_MS = 300;
/** 같은 검색어를 다시 치는 일이 잦고 행정구역은 바뀌지 않으니 길게 잡는다. */
const SEARCH_STALE_TIME_MS = 5 * 60 * 1000;

export function regionSearchQueryKey(query: string): ReadonlyArray<string> {
  return ['region', 'search', query];
}

/**
 * 동네 이름 검색.
 *
 * 응답 경합은 따로 막지 않아도 된다 — 검색어가 쿼리 키에 들어 있어서
 * 늦게 도착한 "수" 응답이 "수유동" 결과를 덮어쓸 수 없다.
 */
export function useRegionSearch(query: string): UseQueryResult<Region[], Error> {
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  return useQuery<Region[], Error>({
    queryKey: regionSearchQueryKey(debouncedQuery),
    queryFn: function loadRegions(): Promise<Region[]> {
      return searchRegionsByKeyword(debouncedQuery);
    },
    enabled: debouncedQuery.length >= MIN_REGION_QUERY_LENGTH,
    staleTime: SEARCH_STALE_TIME_MS,
  });
}
