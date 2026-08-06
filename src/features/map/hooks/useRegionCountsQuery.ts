import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchRegionCounts } from '../api/mapApi';
import type { PostSearchFilters } from '../../browse/types';
import type { RegionCoords } from '../../region/types';
import type { RegionPostCount } from '../types';

const REGION_COUNTS_STALE_TIME_MS = 30_000;

/**
 * 중심·반경·필터가 하나라도 바뀌면 다른 지도다.
 * 객체를 그대로 넣는다 — TanStack Query는 키를 구조적으로 비교한다(검색 목록과 같다).
 */
export function regionCountsQueryKey(
  center: RegionCoords,
  radiusM: number,
  filters: PostSearchFilters,
): ReadonlyArray<string | number | RegionCoords | PostSearchFilters> {
  return ['map', 'regionCounts', center, radiusM, filters];
}

/** 동네를 아직 정하지 않았으면(center가 null) 요청하지 않는다. 그릴 중심이 없다. */
export function useRegionCountsQuery(
  center: RegionCoords | null,
  radiusM: number,
  filters: PostSearchFilters,
): UseQueryResult<RegionPostCount[], Error> {
  return useQuery<RegionPostCount[], Error>({
    queryKey: regionCountsQueryKey(center ?? { lat: 0, lng: 0 }, radiusM, filters),
    queryFn: function loadCounts(): Promise<RegionPostCount[]> {
      if (center === null) {
        return Promise.reject(new Error('동네를 먼저 설정해 주세요.'));
      }
      return fetchRegionCounts({ center, radiusM, filters });
    },
    enabled: center !== null,
    staleTime: REGION_COUNTS_STALE_TIME_MS,
  });
}
