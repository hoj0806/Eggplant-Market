import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findAssetPaths, preflight, probe, smokeTarget } from './httpProbe';
import { findSupabaseUrl } from '../shared/testUtils/bundlePatterns';

/**
 * **Edge Function이 저장소와 같은 판인가.**
 *
 * 이 갈래의 나머지는 프런트엔드를 본다. 그쪽은 Vercel이 `main`을 보고 자동으로 나가므로
 * "머지했는데 안 나갔다"가 생기기 어렵다. **함수는 다르다** — 아무도 안 밀어 준다.
 *
 * 2026-08-10에 그 틈으로 하루가 지났다. 버킷 훑기(0809)가 머지까지 됐는데 배포본은 v2였고,
 * 그동안 옛 코드가 돌아 **고쳤다고 적어 둔 버그가 그대로 재현됐다.** 테스트는 내내 초록이었다 —
 * 그때 아무도 배포된 함수를 안 보고 있었다.
 *
 * 주소는 **배포된 번들에서 뽑는다.** 이 갈래의 규칙이 그렇다(`externalServices`와 같다) —
 * 실제로 서비스되는 값으로 검사한다는 뜻이다.
 */

const FUNCTION_SLUG = 'delete-account';
const SOURCE_PATH = `supabase/functions/${FUNCTION_SLUG}/index.ts`;
const REVISION_HEADER = 'x-function-revision';

/** 저장소가 들고 있는 판. 함수 소스에서 그대로 읽는다. */
function sourceRevision(): string {
  const source = readFileSync(resolve(process.cwd(), SOURCE_PATH), 'utf8');
  const found = /const FUNCTION_REVISION = '([^']+)'/.exec(source);

  if (found === null) {
    throw new Error(`${SOURCE_PATH}에서 FUNCTION_REVISION을 못 찾았다`);
  }
  return found[1];
}

async function functionUrl(): Promise<string> {
  const home = await probe('/');
  const scriptPath = findAssetPaths(home.body).find(function isScript(path: string): boolean {
    return path.endsWith('.js');
  });

  if (scriptPath === undefined) {
    throw new Error(`${smokeTarget()} 의 index.html이 자바스크립트를 안 부른다`);
  }

  const supabaseUrl = findSupabaseUrl((await probe(scriptPath)).body);

  if (supabaseUrl === null) {
    throw new Error('배포된 번들에서 Supabase 주소를 못 찾았다');
  }
  return `${supabaseUrl}/functions/v1/${FUNCTION_SLUG}`;
}

describe(`Edge Function ${FUNCTION_SLUG}`, function deployedFunctionSuite() {
  it('배포돼 있고 preflight가 함수까지 닿는다', async function preflightReachesFunction() {
    // 게이트웨이가 preflight를 검사 없이 통과시키는 덕에 키가 필요 없다.
    // 여기서 204가 아니면 함수가 없거나 죽은 것이다.
    const { status } = await preflight(await functionUrl());

    expect(status).toBe(204);
  });

  /**
   * **오늘 놓친 것을 정확히 잡는 검사다.**
   *
   * 손으로 올리는 값이라 판을 안 올리고 고치면 못 잡는다. 그래도 "아무 그물도 없음"보다
   * 낫다 — 놓친 것은 판이 어긋난 것이 아니라 **아무도 안 본 것**이었다.
   */
  it('배포된 판이 저장소와 같다', async function revisionMatchesSource() {
    const { headers } = await preflight(await functionUrl());
    const deployed = headers.get(REVISION_HEADER);

    expect(deployed).not.toBeNull();
    expect(deployed).toBe(sourceRevision());
  });
});
