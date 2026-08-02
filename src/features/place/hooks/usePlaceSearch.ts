import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { searchPlacesByKeyword } from '../api/placeApi';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import type { RegionCoords } from '../../region/types';
import type { TradePlace } from '../types';

export const MIN_PLACE_QUERY_LENGTH = 2;

const SEARCH_DEBOUNCE_MS = 300;
/** 장소는 자주 바뀌지 않고 같은 검색어를 다시 치는 일이 잦다. */
const SEARCH_STALE_TIME_MS = 5 * 60 * 1000;

/** 중심이 바뀌면 결과도 달라지므로 좌표까지 키에 넣는다. */
export function placeSearchQueryKey(
  query: string,
  center: RegionCoords | null,
): ReadonlyArray<string> {
  return ['place', 'search', query, center === null ? 'nowhere' : `${center.lat},${center.lng}`];
}

/**
 * 장소 이름 검색.
 *
 * 응답 경합은 따로 막지 않아도 된다 — 검색어가 쿼리 키에 들어 있어서
 * 늦게 도착한 "수유" 응답이 "수유역" 결과를 덮어쓸 수 없다.
 */
export function usePlaceSearch(
  query: string,
  center: RegionCoords | null,
): UseQueryResult<TradePlace[], Error> {
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  return useQuery<TradePlace[], Error>({
    queryKey: placeSearchQueryKey(debouncedQuery, center),
    queryFn: function loadPlaces(): Promise<TradePlace[]> {
      return searchPlacesByKeyword(debouncedQuery, center);
    },
    enabled: debouncedQuery.length >= MIN_PLACE_QUERY_LENGTH,
    staleTime: SEARCH_STALE_TIME_MS,
  });
}
