import { toRegionError } from './regionErrors';
import type { RegionCoords, RegionErrorCode } from '../types';

const POSITION_TIMEOUT_MS = 10_000;
const POSITION_MAX_AGE_MS = 60_000;

const PERMISSION_DENIED_CODE = 1;
const POSITION_UNAVAILABLE_CODE = 2;

function toErrorCode(error: GeolocationPositionError): RegionErrorCode {
  if (error.code === PERMISSION_DENIED_CODE) {
    return 'geolocation_denied';
  }
  if (error.code === POSITION_UNAVAILABLE_CODE) {
    return 'geolocation_unavailable';
  }

  return 'geolocation_timeout';
}

/**
 * 현재 위치를 한 번 읽는다.
 * 이 좌표는 어느 동네인지 알아내는 데만 쓰고 저장하지 않는다(Region.coords 주석 참고).
 *
 * isSecureContext를 먼저 보는 이유: http로 열린 페이지에서도 브라우저는 navigator.geolocation을
 * 그대로 노출한 채 PERMISSION_DENIED(1)로 실패시킨다. 그러면 "권한을 거부했다"와 구분할 수 없어
 * 사용자에게 엉뚱한 안내를 하게 된다. localhost는 보안 컨텍스트라 개발에는 영향이 없고,
 * 휴대폰에서 http://192.168.x.x로 접속해 시험할 때 이 분기가 산다.
 */
export function getCurrentCoords(): Promise<RegionCoords> {
  return new Promise(function readPosition(resolve, reject): void {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject(toRegionError('insecure_origin'));
      return;
    }
    if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
      reject(toRegionError('geolocation_unsupported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function handleSuccess(position: GeolocationPosition): void {
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      function handleFailure(error: GeolocationPositionError): void {
        reject(toRegionError(toErrorCode(error)));
      },
      { enableHighAccuracy: false, timeout: POSITION_TIMEOUT_MS, maximumAge: POSITION_MAX_AGE_MS },
    );
  });
}
