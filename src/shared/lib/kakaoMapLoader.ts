import type { KakaoMapsNamespace } from '../types/kakaoMaps';

const KAKAO_APP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;
const SCRIPT_ELEMENT_ID = 'kakao-maps-sdk';

/**
 * 앱키가 없는 것과 스크립트가 실패한 것은 조치가 다르므로 호출한 쪽이 구분할 수 있어야 한다.
 * 앱키는 개발 서버를 다시 시작해야 반영되기 때문에, 이 둘을 같은 문구로 뭉치면 원인을 못 찾는다.
 */
export const KAKAO_KEY_MISSING_CODE = 'kakao_key_missing';
export const KAKAO_LOAD_FAILED_CODE = 'kakao_load_failed';

function toLoaderError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

/**
 * 한 번 시작한 로딩을 재사용한다.
 * StrictMode의 이중 effect나 화면 두 곳에서 동시에 불러도 <script>는 하나만 붙는다.
 * 실패하면 null로 되돌려 다음 시도가 다시 붙일 수 있게 한다.
 */
let loadPromise: Promise<KakaoMapsNamespace> | null = null;

function toScriptSource(): string {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&libraries=services&autoload=false`;
}

/** SDK 스크립트를 붙이고 로드 완료를 기다린다. 이미 붙어 있으면 그 요소를 재사용한다. */
function appendSdkScript(): Promise<void> {
  return new Promise(function attachScript(resolve, reject): void {
    if (window.kakao?.maps !== undefined) {
      resolve();
      return;
    }

    const existing = document.getElementById(SCRIPT_ELEMENT_ID);
    const script =
      existing !== null ? (existing as HTMLScriptElement) : document.createElement('script');

    script.addEventListener('load', function handleScriptLoad(): void {
      resolve();
    });
    script.addEventListener('error', function handleScriptError(): void {
      reject(toLoaderError(KAKAO_LOAD_FAILED_CODE));
    });

    if (existing === null) {
      script.id = SCRIPT_ELEMENT_ID;
      script.async = true;
      script.src = toScriptSource();
      document.head.appendChild(script);
    }
  });
}

/**
 * autoload=false로 받았으므로 kakao.maps.load()를 거쳐야 services가 준비된다.
 * 이 단계를 건너뛰면 Geocoder가 undefined다.
 */
function initializeMaps(): Promise<KakaoMapsNamespace> {
  return new Promise(function waitForMaps(resolve, reject): void {
    const maps = window.kakao?.maps;
    if (maps === undefined) {
      reject(toLoaderError(KAKAO_LOAD_FAILED_CODE));
      return;
    }

    maps.load(function handleMapsReady(): void {
      resolve(maps);
    });
  });
}

function startLoading(): Promise<KakaoMapsNamespace> {
  if (typeof document === 'undefined') {
    return Promise.reject(toLoaderError(KAKAO_LOAD_FAILED_CODE));
  }
  if (KAKAO_APP_KEY === undefined || KAKAO_APP_KEY.length === 0) {
    return Promise.reject(toLoaderError(KAKAO_KEY_MISSING_CODE));
  }

  return appendSdkScript().then(initializeMaps);
}

export function loadKakaoMaps(): Promise<KakaoMapsNamespace> {
  if (loadPromise === null) {
    loadPromise = startLoading().catch(function forgetFailedLoad(error: unknown): never {
      loadPromise = null;
      throw error;
    });
  }

  return loadPromise;
}
