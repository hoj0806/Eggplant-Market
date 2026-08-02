import { toRegionErrorMessage } from './regionErrorMessage';
import { toRegionError } from './regionErrors';
import type { RegionErrorCode } from '../types';

const ALL_CODES: ReadonlyArray<RegionErrorCode> = [
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

describe('toRegionErrorMessage', function regionErrorMessageSuite() {
  it('모든 코드가 코드 문자열이 아닌 안내 문구로 바뀐다', function everyCodeCase() {
    for (const code of ALL_CODES) {
      const message = toRegionErrorMessage(toRegionError(code));

      expect(message).not.toBe(code);
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it('위치를 쓸 수 없는 상황에서는 대신 검색하라고 안내한다', function fallbackGuidanceCase() {
    expect(toRegionErrorMessage(toRegionError('geolocation_denied'))).toContain('검색');
    expect(toRegionErrorMessage(toRegionError('insecure_origin'))).toContain('검색');
    expect(toRegionErrorMessage(toRegionError('geolocation_unsupported'))).toContain('검색');
  });

  it('권한 거부와 비보안 출처를 다르게 안내한다', function distinctMessagesCase() {
    const denied = toRegionErrorMessage(toRegionError('geolocation_denied'));
    const insecure = toRegionErrorMessage(toRegionError('insecure_origin'));

    expect(denied).not.toBe(insecure);
  });

  it('앱키 누락과 SDK 로드 실패를 다르게 안내한다', function sdkFailureCase() {
    const keyMissing = toRegionErrorMessage(toRegionError('sdk_key_missing'));

    expect(keyMissing).toContain('VITE_KAKAO_MAP_KEY');
    expect(keyMissing).not.toBe(toRegionErrorMessage(toRegionError('sdk_load_failed')));
  });

  it('코드가 없는 네트워크 오류는 패턴으로 잡는다', function networkCase() {
    expect(toRegionErrorMessage(new Error('Failed to fetch'))).toBe(
      '네트워크 연결을 확인해 주세요.',
    );
  });

  it('모르는 오류는 기본 문구로 돌려준다', function unknownCase() {
    expect(toRegionErrorMessage(new Error('무언가 이상함'))).toBe(
      '동네 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  });
});
