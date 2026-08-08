import type { RegionErrorCode } from '../types';

/**
 * 동네 설정에서 나는 실패를 문자열 code를 가진 Error로 통일한다.
 *
 * 브라우저 GeolocationPositionError.code는 숫자(1·2·3)이고 message는 브라우저마다 다른 영어라
 * 그대로 흘리면 원인을 구분할 수 없다. 카카오 SDK도 예외가 아니라 status 문자열로 실패를 알린다.
 * 두 경로를 같은 모양으로 맞춰야 화면에서 한 번에 처리할 수 있다.
 */
const REGION_ERROR_CODES: ReadonlyArray<RegionErrorCode> = [
  'insecure_origin',
  'geolocation_unsupported',
  'geolocation_denied',
  'geolocation_unavailable',
  'geolocation_timeout',
  'sdk_key_missing',
  'sdk_load_failed',
  'geocode_zero_result',
  'geocode_failed',
];

export function toRegionError(code: RegionErrorCode): Error & { code: RegionErrorCode } {
  return Object.assign(new Error(code), { code });
}

/** 던져진 값에서 우리가 아는 코드를 뽑아낸다. 모르는 오류면 null. */
export function toRegionErrorCode(error: unknown): RegionErrorCode | null {
  if (error === null || typeof error !== 'object') {
    return null;
  }

  const candidate = error as { code?: unknown };
  const found = REGION_ERROR_CODES.find(function matchesCode(code: RegionErrorCode): boolean {
    return candidate.code === code;
  });

  return found ?? null;
}
