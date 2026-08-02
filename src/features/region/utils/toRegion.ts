// 카카오 SDK 응답을 앱의 Region으로 옮기는 순수 변환 함수들.

import type {
  KakaoAddressSearchResult,
  KakaoRegionCodeResult,
} from '../../../shared/types/kakaoMaps';
import type { Region } from '../types';

const LEGAL_REGION_TYPE = 'B';

/** 시/군/구가 없는 지역(세종특별자치시 등)은 빈 문자열로 오므로 걸러서 잇는다. */
export function toRegionFullName(depth1: string, depth2: string, depth3: string): string {
  return [depth1, depth2, depth3]
    .map(function trimPart(part: string): string {
      return part.trim();
    })
    .filter(function keepFilled(part: string): boolean {
      return part.length > 0;
    })
    .join(' ');
}

/**
 * 법정동(B)을 우선으로 고르고, 없으면 행정동(H)으로 물러선다.
 * 주소 검색 결과(b_code)와 코드 체계를 맞추기 위해 B가 기준이다.
 */
export function pickRegionCodeResult(
  results: ReadonlyArray<KakaoRegionCodeResult>,
): KakaoRegionCodeResult | null {
  const legal = results.find(function isLegalRegion(entry: KakaoRegionCodeResult): boolean {
    return entry.region_type === LEGAL_REGION_TYPE;
  });
  if (legal !== undefined) {
    return legal;
  }

  return results[0] ?? null;
}

/** coord2RegionCode 결과 → Region. 좌표는 사용자 위치가 아니라 동네 대표 좌표(entry.x/y)를 쓴다. */
export function fromRegionCodeResult(entry: KakaoRegionCodeResult): Region {
  return {
    code: entry.code,
    depth1: entry.region_1depth_name,
    depth2: entry.region_2depth_name,
    depth3: entry.region_3depth_name,
    fullName: toRegionFullName(
      entry.region_1depth_name,
      entry.region_2depth_name,
      entry.region_3depth_name,
    ),
    coords: { lat: entry.y, lng: entry.x },
  };
}

/** 빈 문자열을 Number()에 넣으면 0이 나온다. 좌표 0을 유효한 값으로 받아들이면 안 된다. */
function toCoordinate(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * addressSearch 결과 → Region.
 * 지번 주소가 없는(도로명만 잡힌) 결과와 동 단위까지 내려가지 않은 결과는 동네로 쓸 수 없어 null이다.
 * 좌표는 문자열로 오므로 숫자로 바꾼다.
 */
export function fromAddressSearchResult(entry: KakaoAddressSearchResult): Region | null {
  const address = entry.address;
  if (address === null) {
    return null;
  }
  if (address.region_3depth_name.trim().length === 0 || address.b_code.length === 0) {
    return null;
  }

  const lat = toCoordinate(address.y);
  const lng = toCoordinate(address.x);
  if (lat === null || lng === null) {
    return null;
  }

  return {
    code: address.b_code,
    depth1: address.region_1depth_name,
    depth2: address.region_2depth_name,
    depth3: address.region_3depth_name,
    fullName: toRegionFullName(
      address.region_1depth_name,
      address.region_2depth_name,
      address.region_3depth_name,
    ),
    coords: { lat, lng },
  };
}

/** 같은 동네의 여러 지번이 걸리므로 법정동 코드로 접는다. 먼저 나온 것을 남긴다. */
export function dedupeRegionsByCode(regions: ReadonlyArray<Region>): Region[] {
  const seen = new Set<string>();
  const result: Region[] = [];

  for (const region of regions) {
    if (seen.has(region.code)) {
      continue;
    }
    seen.add(region.code);
    result.push(region);
  }

  return result;
}
