// 카카오 장소 검색 응답을 앱의 TradePlace로 옮기는 순수 변환 함수들.

import type { KakaoPlaceSearchResult } from '../../../shared/types/kakaoMaps';
import type { TradePlace } from '../types';

/** 빈 문자열을 Number()에 넣으면 0이 나온다. 좌표 0을 유효한 값으로 받아들이면 안 된다. */
function toCoordinate(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/** 도로명 주소를 먼저 쓴다. 신축 건물 등 도로명이 없는 장소는 지번으로 물러선다. */
function toAddressName(entry: KakaoPlaceSearchResult): string {
  const road = entry.road_address_name.trim();

  return road.length > 0 ? road : entry.address_name.trim();
}

/**
 * 장소 검색 결과 → TradePlace.
 * 이름이나 좌표가 비어 있는 결과는 지도에 찍을 수도, 상대에게 알려 줄 수도 없어 null이다.
 */
export function fromPlaceSearchResult(entry: KakaoPlaceSearchResult): TradePlace | null {
  const name = entry.place_name.trim();
  if (name.length === 0) {
    return null;
  }

  const lat = toCoordinate(entry.y);
  const lng = toCoordinate(entry.x);
  if (lat === null || lng === null) {
    return null;
  }

  return {
    id: entry.id,
    name,
    addressName: toAddressName(entry),
    coords: { lat, lng },
  };
}

/** 같은 장소가 두 번 오는 경우를 접는다. 먼저 나온 것(=더 가까운 것)을 남긴다. */
export function dedupePlacesById(places: ReadonlyArray<TradePlace>): TradePlace[] {
  const seen = new Set<string>();
  const result: TradePlace[] = [];

  for (const place of places) {
    if (seen.has(place.id)) {
      continue;
    }
    seen.add(place.id);
    result.push(place);
  }

  return result;
}
