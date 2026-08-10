import type { KakaoShareNamespace } from '../types/kakaoShare';

/**
 * 카카오톡 공유 SDK를 붙인다.
 *
 * ── 지도 SDK와 **다른 스크립트**다 ────────────────────────────────────
 * 이름이 같은 `window.kakao`에 붙지만 받아 오는 파일이 다르다.
 *
 *   지도   `dapi.kakao.com/v2/maps/sdk.js`      → `kakao.maps`
 *   공유   `t1.kakaocdn.net/kakao_js_sdk/…`     → `kakao.Share` (+ `Kakao.init` 필요)
 *
 * 그래서 `kakaoMapLoader`를 나눠 쓸 수 없다. 대신 **앱키는 같은 것**을 쓴다 —
 * 둘 다 카카오 개발자 콘솔의 **JavaScript 앱키**다. 새 환경변수를 만들지 않는 이유가 있다:
 * 2026-08-09에 Vercel에 앱키를 넣다 **한 글자가 잘려** 지도가 통째로 죽었다. 손으로 옮기는
 * 값은 적을수록 좋고, 이미 있는 값은 `test:build`가 형식·길이를 지키고 있다.
 *
 * ── `init`을 여기서 한 번만 부른다 ────────────────────────────────────
 * 공유 SDK는 스크립트를 받은 뒤 `Kakao.init(앱키)`를 거쳐야 쓸 수 있고, 두 번 부르면
 * 경고를 낸다. 로딩 약속을 하나로 묶어 두면(지도 로더와 같은 방식) 화면 여러 곳에서
 * 동시에 눌러도 스크립트도 `init`도 한 번이다.
 */

const KAKAO_APP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;
const SCRIPT_ELEMENT_ID = 'kakao-share-sdk';

/**
 * 판을 고정한다. 카카오가 최신을 가리키는 주소도 주지만, **받는 파일이 조용히 바뀌는 것**은
 * 배포와 무관하게 화면이 달라지는 길이다 — 이 저장소가 자산에 해시를 요구하는 것과 같은 이유.
 */
const SDK_VERSION = '2.7.4';
const SDK_SOURCE = `https://t1.kakaocdn.net/kakao_js_sdk/${SDK_VERSION}/kakao.min.js`;

/** 앱키가 없는 것과 스크립트가 실패한 것은 조치가 다르다(지도 로더와 같은 갈래). */
export const KAKAO_SHARE_KEY_MISSING_CODE = 'kakao_share_key_missing';
export const KAKAO_SHARE_LOAD_FAILED_CODE = 'kakao_share_load_failed';

function toLoaderError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

let loadPromise: Promise<KakaoShareNamespace> | null = null;

function appendSdkScript(): Promise<void> {
  return new Promise(function attachScript(resolve, reject): void {
    if (window.Kakao !== undefined) {
      resolve();
      return;
    }

    // 한 번 실패한 <script>에 리스너를 달면 load도 error도 이미 끝난 뒤라 영원히 멈춘다.
    const stale = document.getElementById(SCRIPT_ELEMENT_ID);
    if (stale !== null) {
      stale.remove();
    }

    const script = document.createElement('script');
    script.addEventListener('load', function handleLoad(): void {
      resolve();
    });
    script.addEventListener('error', function handleError(): void {
      reject(toLoaderError(KAKAO_SHARE_LOAD_FAILED_CODE));
    });

    script.id = SCRIPT_ELEMENT_ID;
    script.async = true;
    script.src = SDK_SOURCE;
    document.head.appendChild(script);
  });
}

function initialize(): KakaoShareNamespace {
  const sdk = window.Kakao;

  if (sdk === undefined) {
    throw toLoaderError(KAKAO_SHARE_LOAD_FAILED_CODE);
  }

  if (!sdk.isInitialized()) {
    sdk.init(KAKAO_APP_KEY as string);
  }

  return sdk;
}

/** 공유 SDK를 준비해 돌려준다. 여러 번 불러도 스크립트와 `init`은 한 번씩이다. */
export function loadKakaoShare(): Promise<KakaoShareNamespace> {
  if (loadPromise !== null) {
    return loadPromise;
  }

  if (typeof document === 'undefined') {
    return Promise.reject(toLoaderError(KAKAO_SHARE_LOAD_FAILED_CODE));
  }
  if (KAKAO_APP_KEY === undefined || KAKAO_APP_KEY.length === 0) {
    return Promise.reject(toLoaderError(KAKAO_SHARE_KEY_MISSING_CODE));
  }

  loadPromise = appendSdkScript()
    .then(initialize)
    .catch(function forgetFailure(error: unknown): never {
      // 실패는 기억하지 않는다. 네트워크가 돌아오면 다음 클릭이 다시 붙일 수 있어야 한다.
      loadPromise = null;
      throw error;
    });

  return loadPromise;
}
