/**
 * 배포된 사이트를 밖에서 두드린다.
 *
 * `build` 갈래는 *"제대로 만들어졌는가"*를 묻고, 여기는 *"제대로 서비스되는가"*를 묻는다.
 * **빌드가 맞아도 배포가 틀릴 수 있다** — 2026-08-08에 환경변수를 고치고 재배포를 안 해
 * 옛 번들이 계속 나갔다. 그때 `dist/`는 내내 옳았다.
 */

const TARGET_ENV_NAME = 'SMOKE_URL';

export type Probe = {
  url: string;
  status: number;
  contentType: string;
  cacheControl: string;
  body: string;
};

/**
 * 검사할 주소. **없으면 실패시킨다.**
 *
 * 주소가 없을 때 조용히 건너뛰면 **초록인 채로 아무것도 안 지키는 테스트**가 된다.
 * 그런 초록은 그물이 없는 것보다 나쁘다 — 있다고 믿게 만들기 때문이다.
 */
export function smokeTarget(): string {
  const value = process.env[TARGET_ENV_NAME];

  if (value === undefined || value.trim() === '') {
    throw new Error(
      `검사할 주소가 없다. \`npm run test:smoke -- https://…\` 로 주소를 주거나 ` +
        `${TARGET_ENV_NAME} 환경변수를 채운다. (건너뛰지 않고 실패시키는 것이 의도다.)`,
    );
  }
  return value.trim().replace(/\/+$/, '');
}

const cache = new Map<string, Promise<Probe>>();

async function request(url: string, headers: Record<string, string>): Promise<Probe> {
  // 리다이렉트를 따라가지 않는다. 따라가면 Vercel의 배포 보호 로그인 화면을 200으로
  // 받아 들고 "잘 뜬다"고 착각한다.
  const response = await fetch(url, { headers, redirect: 'manual' });

  return {
    url,
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    cacheControl: response.headers.get('cache-control') ?? '',
    body: await response.text(),
  };
}

/** 같은 주소를 여러 테스트가 본다. 한 번만 받아 온다. */
export function probe(path: string, headers: Record<string, string> = {}): Promise<Probe> {
  const url = path.startsWith('http') ? path : `${smokeTarget()}${path}`;
  const key = `${url}\n${JSON.stringify(headers)}`;
  const pending = cache.get(key);

  if (pending !== undefined) {
    return pending;
  }

  const started = request(url, headers);
  cache.set(key, started);
  return started;
}

/**
 * preflight(OPTIONS)를 보내고 **응답 헤더**를 받는다.
 *
 * Edge Function은 `verify_jwt: true`라 GET·POST가 게이트웨이에서 401로 막히는데,
 * **preflight는 검사 없이 함수까지 간다.** 키 없이 함수에게 무언가 물어볼 수 있는
 * 유일한 창이라, 배포된 판을 확인하는 데 쓴다.
 */
export async function preflight(url: string): Promise<{ status: number; headers: Headers }> {
  const response = await fetch(url, { method: 'OPTIONS', redirect: 'manual' });

  return { status: response.status, headers: response.headers };
}

/** `index.html`이 부르는 자산 경로들. 해시가 붙어 있어 미리 알 수 없다. */
export function findAssetPaths(html: string): string[] {
  return Array.from(html.matchAll(/["'](\/assets\/[^"']+)["']/g)).map(
    function pickPath(found: RegExpMatchArray): string {
      return found[1];
    },
  );
}
