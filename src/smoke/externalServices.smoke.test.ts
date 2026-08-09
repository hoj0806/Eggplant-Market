import { findAssetPaths, probe, smokeTarget } from './httpProbe';
import { findAnonKey, findKakaoAppKeys, findSupabaseUrl } from '../shared/testUtils/bundlePatterns';

/**
 * 밖의 서비스가 **이 도메인을 받아 주는가.**
 *
 * 카카오 지도와 Supabase 인증은 콘솔에 도메인을 등록해야 동작한다. 코드에는 아무 흔적도
 * 남지 않아서, **등록을 빠뜨려도 저장소만 봐서는 알 수 없다.** 배포할 때마다 사람이
 * 기억해야 하는 자리라 그물을 건다.
 *
 * 열쇠는 저장소에 없으므로 **배포된 번들에서 뽑아 쓴다.** 실제로 서비스되는 값으로
 * 검사한다는 뜻이기도 하다.
 */

const UNREGISTERED_REFERER = 'https://not-registered.example.com';

async function readDeployedBundle(): Promise<string> {
  const home = await probe('/');
  const scriptPath = findAssetPaths(home.body).find(function isScript(path: string): boolean {
    return path.endsWith('.js');
  });

  if (scriptPath === undefined) {
    throw new Error(`${smokeTarget()} 의 index.html이 자바스크립트를 안 부른다`);
  }
  return (await probe(scriptPath)).body;
}

function kakaoSdkUrl(appKey: string): string {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=services&autoload=false`;
}

describe('카카오 지도 SDK', function kakaoSuite() {
  async function appKey(): Promise<string> {
    const keys = findKakaoAppKeys(await readDeployedBundle());

    if (keys.length === 0) {
      throw new Error('배포된 번들에서 카카오 앱키를 못 찾았다');
    }
    return keys[0];
  }

  it('배포 주소에서 부르면 내려온다', async function sdkLoadsFromDeployedDomain() {
    // 카카오는 **Referer로** 도메인을 검사한다. 등록을 빠뜨리면 지도만 조용히 안 뜬다.
    const sdk = await probe(kakaoSdkUrl(await appKey()), { Referer: `${smokeTarget()}/` });

    expect(sdk.status).toBe(200);
  });

  it('등록 안 한 주소에서 부르면 막힌다', async function sdkRejectsOtherDomains() {
    // **위 검사가 실제로 무엇을 재는지 확인하는 자리다.** 카카오가 아무 Referer나
    // 받아 준다면 위 초록은 "등록됐다"는 뜻이 아니라 그냥 "서버가 살아 있다"는 뜻이 된다.
    const sdk = await probe(kakaoSdkUrl(await appKey()), { Referer: UNREGISTERED_REFERER });

    expect(sdk.status).not.toBe(200);
  });
});

describe('Supabase 인증 설정', function authSettingsSuite() {
  async function settings(): Promise<Record<string, unknown>> {
    const bundle = await readDeployedBundle();
    const url = findSupabaseUrl(bundle);
    const anonKey = findAnonKey(bundle);

    if (url === null || anonKey === null) {
      throw new Error('배포된 번들에서 Supabase 주소나 공개 키를 못 찾았다');
    }

    const response = await probe(`${url}/auth/v1/settings`, { apikey: anonKey });

    expect(response.status).toBe(200);
    return JSON.parse(response.body) as Record<string, unknown>;
  }

  it('카카오와 구글만 켜져 있다', async function onlySocialProvidersAreOn() {
    const external = (await settings()).external as Record<string, boolean>;

    expect(external.kakao).toBe(true);
    expect(external.google).toBe(true);
    // 이메일 로그인은 2026-08-07에 걷어냈다. 다시 켜지면 없는 화면으로 사람이 들어온다.
    expect(external.email).toBe(false);
  });
});

/**
 * **밖에서 못 재는 것 하나 — Supabase Redirect URLs.**
 *
 * `/authorize`는 **등록하지 않은 주소도 그대로 통과시킨다**(2026-08-08 확인).
 * GoTrue는 콜백으로 돌아올 때 검사하기 때문이다. 그래서 이 항목만은
 * **실제로 로그인해 봐야** 안다. 스모크에 넣으면 초록인 채로 아무것도 안 지킨다.
 *
 * 같은 이유로 Vercel Preview 배포도 여기서 못 잰다 — 배포 보호가 걸려 있어
 * 모든 요청이 로그인 화면으로 302된다(2026-08-09 확인).
 */
