// 동네 설정 실패를 사용자에게 보여줄 한국어 문구로 바꾼다.

import { matchErrorMessage } from '../../../shared/utils/errorText';
import { toRegionErrorCode } from './regionErrors';
import type { RegionErrorCode } from '../types';

const DEFAULT_REGION_ERROR_MESSAGE = '동네 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * 원인이 분명한 실패는 정규식 매칭 없이 코드로 바로 찾는다.
 * 위치 실패는 하나같이 "그럼 어떻게 하라는 건지"를 함께 알려 줘야 사용자가 막히지 않는다.
 */
const REGION_ERROR_MESSAGES: Record<RegionErrorCode, string> = {
  insecure_origin:
    'HTTPS 연결에서만 현재 위치를 쓸 수 있습니다. 동네 이름으로 검색해 주세요.',
  geolocation_unsupported:
    '이 브라우저에서는 현재 위치를 쓸 수 없습니다. 동네 이름으로 검색해 주세요.',
  geolocation_denied:
    '위치 권한이 거부되었습니다. 브라우저 설정에서 허용하거나 동네 이름으로 검색해 주세요.',
  geolocation_unavailable:
    '현재 위치를 확인할 수 없습니다. 동네 이름으로 검색해 주세요.',
  geolocation_timeout:
    '위치 확인이 오래 걸립니다. 다시 시도하거나 동네 이름으로 검색해 주세요.',
  // 개발자에게 하는 말이다. 앱키가 비어 있는 것과 스크립트가 거부당한 것은 원인도 조치도 다르다.
  sdk_key_missing:
    '카카오맵 앱키가 없습니다. .env.local의 VITE_KAKAO_MAP_KEY를 확인하고 개발 서버를 다시 시작해 주세요.',
  // 브라우저는 <script> 로드 실패의 응답 본문을 읽을 수 없어 원인을 좁힐 수 없다.
  // 실제로 겪은 두 가지(카카오맵 제품 미활성화, 도메인 미등록)를 모두 짚어 준다.
  sdk_load_failed:
    '지도 서비스를 불러오지 못했습니다. 카카오 콘솔에서 카카오맵이 활성화되어 있는지, 이 주소가 도메인으로 등록되어 있는지 확인해 주세요.',
  geocode_zero_result: '현재 위치에서 동네를 찾지 못했습니다. 동네 이름으로 검색해 주세요.',
  geocode_failed: '동네 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
};

// 코드가 없는 오류(네트워크 등)를 위한 최소한의 패턴.
const MESSAGE_BY_PATTERN: ReadonlyArray<readonly [RegExp, string]> = [
  [/failed to fetch|network|networkerror/, '네트워크 연결을 확인해 주세요.'],
];

export function toRegionErrorMessage(error: unknown): string {
  const code = toRegionErrorCode(error);
  if (code !== null) {
    return REGION_ERROR_MESSAGES[code];
  }

  return matchErrorMessage(error, MESSAGE_BY_PATTERN, DEFAULT_REGION_ERROR_MESSAGE);
}
