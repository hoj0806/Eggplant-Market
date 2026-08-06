import {
  KAKAO_KEY_MISSING_CODE,
  KAKAO_LOAD_FAILED_CODE,
} from '../../../shared/lib/kakaoMapLoader';
import type { MapErrorCode } from '../types';

/**
 * 로더가 던진 것을 지도가 아는 코드로 옮기고, 사용자에게 할 말을 고른다.
 *
 * 앱키가 없는 것과 스크립트가 실패한 것을 갈라 두는 이유는 **조치가 다르기 때문**이다
 * (로더가 코드를 둘로 나눈 이유와 같다). 앱키는 개발자가 `.env`를 고치고 서버를 다시
 * 띄워야 하고, 실패는 사용자가 다시 시도해 볼 수 있다. 한 문구로 뭉치면 둘 다 막힌다.
 */
export function toMapErrorCode(error: unknown): MapErrorCode {
  if (error !== null && typeof error === 'object') {
    const candidate = error as { code?: unknown };

    if (candidate.code === KAKAO_KEY_MISSING_CODE) {
      return 'sdk_key_missing';
    }
    if (candidate.code === KAKAO_LOAD_FAILED_CODE) {
      return 'sdk_load_failed';
    }
  }

  // 모르는 오류도 사용자에게는 "지도가 안 뜬다"는 같은 사건이다. 다시 시도할 수 있는 쪽으로 본다.
  return 'sdk_load_failed';
}

export function toMapErrorMessage(code: MapErrorCode): string {
  if (code === 'sdk_key_missing') {
    return '지도 서비스가 설정되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  }

  return '지도를 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.';
}
