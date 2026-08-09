import { findAssetPaths, probe, smokeTarget } from './httpProbe';
import {
  ANON_KEY_PATTERN,
  findKakaoAppKeys,
  KAKAO_SDK_URL_FRAGMENT,
  SECRET_PATTERNS,
  SERVER_ONLY_ENV_NAME,
  SUPABASE_URL_PATTERN,
} from '../shared/testUtils/bundlePatterns';
import { OG_IMAGE_PATH } from '../shared/ui/siteMeta';

/**
 * 배포된 사이트를 밖에서 검사한다.
 *
 * `build` 갈래와 겹치는 검사가 있는데 **일부러 그렇다.** 빌드가 맞아도 배포가 틀릴 수 있다.
 */

/** 라우터가 맡는 경로들. 서버에는 이런 파일이 없으므로 폴백이 없으면 404다. */
const ROUTER_PATHS = ['/posts/1', '/settings/account', '/chat'];

/** 정적 파일과 그 Content-Type. `text/html`이 오면 폴백이 가로챈 것이다. */
const STATIC_FILES: ReadonlyArray<readonly [string, RegExp]> = [
  ['/favicon.svg', /image\/svg\+xml/],
  ['/favicon.ico', /image\/(x-icon|vnd\.microsoft\.icon)/],
  [OG_IMAGE_PATH, /image\/png/],
];

describe('배포된 사이트', function deployedSiteSuite() {
  it('첫 화면이 뜬다', async function homeResponds() {
    const home = await probe('/');

    expect(home.status).toBe(200);
    expect(home.contentType).toMatch(/text\/html/);
    expect(home.body).toContain('<div id="root">');
  });

  describe('SPA 폴백', function fallbackSuite() {
    it.each(ROUTER_PATHS)('%s가 index.html로 응답한다', async function routeFallsBack(path: string) {
      // 폴백이 없으면 새로고침이 404다. vercel.json의 rewrite가 하는 일.
      const page = await probe(path);

      expect(page.status).toBe(200);
      expect(page.contentType).toMatch(/text\/html/);
      expect(page.body).toContain('<div id="root">');
    });
  });

  describe('정적 파일이 폴백에 가로채이지 않는다', function staticFilesSuite() {
    it.each(STATIC_FILES)(
      '%s가 진짜 파일로 온다',
      async function staticFileIsReal(path: string, contentType: RegExp) {
        // 고치기 전 상태가 정확히 이것이었다 —
        // `GET /favicon.ico → 200 · text/html`. 200이라 실패로 보이지도 않는다.
        const file = await probe(path);

        expect(file.status).toBe(200);
        expect(file.contentType).toMatch(contentType);
      },
    );
  });

  describe('자산', function assetSuite() {
    it('index.html이 해시 붙은 자산을 부른다', async function htmlReferencesAssets() {
      const home = await probe('/');

      expect(findAssetPaths(home.body).length).toBeGreaterThan(0);
    });

    it('1년 캐시 헤더가 붙는다', async function assetsAreCachedForever() {
      // 해시가 이름에 있어 안전한 캐시다. 헤더가 빠지면 재방문자가 매번 다시 받는다.
      const home = await probe('/');
      const assetPath = findAssetPaths(home.body)[0];
      const asset = await probe(assetPath);

      expect(asset.status).toBe(200);
      expect(asset.cacheControl).toContain('max-age=31536000');
      expect(asset.cacheControl).toContain('immutable');
    });
  });

  describe('배포된 번들 안', function deployedBundleSuite() {
    async function fetchBundle(): Promise<string> {
      const home = await probe('/');
      const scriptPath = findAssetPaths(home.body).find(function isScript(path: string): boolean {
        return path.endsWith('.js');
      });

      if (scriptPath === undefined) {
        throw new Error(`${smokeTarget()} 의 index.html이 자바스크립트를 안 부른다`);
      }
      return (await probe(scriptPath)).body;
    }

    it('Supabase 주소와 공개 키가 박혀 있다', async function envIsBaked() {
      const bundle = await fetchBundle();

      expect(bundle).toMatch(SUPABASE_URL_PATTERN);
      expect(bundle).toMatch(ANON_KEY_PATTERN);
    });

    it('카카오 앱키가 온전하고 SDK 주소가 있다', async function kakaoIsBaked() {
      const bundle = await fetchBundle();

      expect(findKakaoAppKeys(bundle).length).toBeGreaterThan(0);
      expect(bundle).toContain(KAKAO_SDK_URL_FRAGMENT);
    });

    it('비밀이 안 섞였다', async function noSecretsAreServed() {
      const bundle = await fetchBundle();

      for (const [, pattern] of SECRET_PATTERNS) {
        expect(bundle).not.toMatch(pattern);
      }
      expect(bundle).not.toContain(SERVER_ONLY_ENV_NAME);
    });
  });
});
