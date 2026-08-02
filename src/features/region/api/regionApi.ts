/**
 * 카카오 Geocoder 호출을 감싸는 유일한 자리.
 *
 * - 콜백 기반 SDK를 Promise로 바꾸고, status 문자열을 우리 RegionErrorCode로 옮긴다.
 * - Supabase는 건드리지 않는다. 동네 저장은 profiles의 일이라 features/profile이 맡는다.
 * - 이 모듈만 kakaoMapLoader(=import.meta.env)에 닿는다. ts-jest는 CommonJS로 옮기면서
 *   import.meta를 그대로 뱉기 때문에, 테스트에서 이 모듈에 닿으면 로드 단계에서 죽는다.
 *   그래서 컴포넌트 테스트는 이 모듈을 통째로 jest.mock 한다.
 */
import { KAKAO_KEY_MISSING_CODE, loadKakaoMaps } from '../../../shared/lib/kakaoMapLoader';
import { toRegionError } from '../utils/regionErrors';
import {
  dedupeRegionsByCode,
  fromAddressSearchResult,
  fromRegionCodeResult,
  pickRegionCodeResult,
} from '../utils/toRegion';
import type { KakaoGeocoder } from '../../../shared/types/kakaoMaps';
import type { Region, RegionCoords } from '../types';

const MAX_REGION_RESULTS = 15;

/** Geocoder는 한 번만 만들어 재사용한다. 실패하면 비워 다음 시도가 다시 붙게 한다. */
let geocoderPromise: Promise<KakaoGeocoder> | null = null;

function isKeyMissing(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: unknown }).code === KAKAO_KEY_MISSING_CODE;
}

function loadGeocoder(): Promise<KakaoGeocoder> {
  if (geocoderPromise === null) {
    geocoderPromise = loadKakaoMaps()
      .then(function createGeocoder(maps): KakaoGeocoder {
        return new maps.services.Geocoder();
      })
      .catch(function forgetFailedLoad(error: unknown): never {
        geocoderPromise = null;
        throw toRegionError(isKeyMissing(error) ? 'sdk_key_missing' : 'sdk_load_failed');
      });
  }

  return geocoderPromise;
}

function isRegion(region: Region | null): region is Region {
  return region !== null;
}

/** 좌표 → 동네. GPS로 찾을 때 쓴다. */
export async function coordsToRegion(coords: RegionCoords): Promise<Region> {
  const geocoder = await loadGeocoder();

  return new Promise(function resolveRegion(resolve, reject): void {
    // 인자 순서가 (경도, 위도)다.
    geocoder.coord2RegionCode(
      coords.lng,
      coords.lat,
      function handleRegionCode(result, status): void {
        if (status === 'ZERO_RESULT') {
          reject(toRegionError('geocode_zero_result'));
          return;
        }
        if (status !== 'OK') {
          reject(toRegionError('geocode_failed'));
          return;
        }

        // 바다·비무장지대처럼 행정구역이 없는 좌표에서는 결과가 비어 온다.
        const entry = pickRegionCodeResult(result);
        if (entry === null) {
          reject(toRegionError('geocode_zero_result'));
          return;
        }

        resolve(fromRegionCodeResult(entry));
      },
    );
  });
}

/** 동네 이름 검색. 결과가 없는 것은 오류가 아니라 빈 목록이다. */
export async function searchRegionsByKeyword(query: string): Promise<Region[]> {
  const geocoder = await loadGeocoder();

  return new Promise(function resolveRegions(resolve, reject): void {
    geocoder.addressSearch(query, function handleAddresses(result, status): void {
      if (status === 'ZERO_RESULT') {
        resolve([]);
        return;
      }
      if (status !== 'OK') {
        reject(toRegionError('geocode_failed'));
        return;
      }

      const regions = result.map(fromAddressSearchResult).filter(isRegion);

      resolve(dedupeRegionsByCode(regions).slice(0, MAX_REGION_RESULTS));
    });
  });
}
