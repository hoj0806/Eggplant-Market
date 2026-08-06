import { supabase } from '../../../shared/lib/supabaseClient';
import type { PostSearchFilters } from '../../browse/types';
import type { RegionCoords } from '../../region/types';
import type { RegionPostCount } from '../types';

type RegionCountRow = {
  region_code: string;
  dong_name: string | null;
  lat: number;
  lng: number;
  post_count: number;
  distance_m: number;
};

export type FetchRegionCountsParams = {
  /** 반경의 중심. 내 동네 대표 좌표다. */
  center: RegionCoords;
  radiusM: number;
  /** 검색 화면에서 걸고 온 조건. 그대로 이어받아야 목록과 지도가 같은 것을 센다. */
  filters: PostSearchFilters;
};

function toRegionPostCount(row: RegionCountRow): RegionPostCount {
  return {
    regionCode: row.region_code,
    // 서버가 최빈값을 고르지만 옛 글에는 이름이 없을 수 있다. 코드만으로는 읽을 수 없어 갈음한다.
    dongName: row.dong_name ?? '이름 없는 동네',
    coords: { lat: row.lat, lng: row.lng },
    postCount: row.post_count,
    distanceM: row.distance_m,
  };
}

/**
 * 반경 안의 동네별 게시물 수. 지도의 마커가 이 목록 그대로다.
 *
 * 페이징이 없다. 지도는 **한눈에 보는 화면**이라 절반만 그리면 "이쪽에는 물건이 없다"로
 * 읽힌다 — 목록의 무한 스크롤과 성격이 다르다. 대신 서버가 300개에서 자른다(0025).
 *
 * 조건은 `search_posts`와 같은 `private.posts_in_scope`를 거친다. 그래서 마커에 적힌 숫자와
 * 그 마커를 눌러 나오는 목록의 길이가 어긋나지 않는다 — 특히 **차단**이 그렇다.
 */
export async function fetchRegionCounts(
  params: FetchRegionCountsParams,
): Promise<RegionPostCount[]> {
  const { data, error } = await supabase.rpc('nearby_region_counts', {
    p_lat: params.center.lat,
    p_lng: params.center.lng,
    p_radius_m: params.radiusM,
    p_keyword: params.filters.keyword === '' ? null : params.filters.keyword,
    p_category_id: params.filters.categoryId,
    p_min_price: params.filters.minPrice,
    p_max_price: params.filters.maxPrice,
    p_available_only: params.filters.availableOnly,
  });

  if (error !== null) {
    throw error;
  }

  return (data as RegionCountRow[]).map(toRegionPostCount);
}
