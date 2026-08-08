import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `.env.local`을 읽어 `process.env`에 넣는다.
 *
 * 앱은 `import.meta.env`(Vite)로 환경변수를 읽지만 **통합 테스트는 Node에서 돌아** 그 길이 없다.
 * dotenv를 새로 들이는 대신 여기서 직접 읽는다 — 형식이 `KEY=VALUE` 뿐이라 파서가 몇 줄이면 되고,
 * 테스트만 쓰는 의존성을 늘리지 않는 편이 낫다.
 *
 * 이미 들어 있는 값은 덮지 않는다. CI에서 실제 환경변수로 넣는 길을 막지 않기 위해서다.
 */
export function loadTestEnv(): void {
  let raw: string;

  try {
    raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  } catch {
    // 파일이 없어도 여기서 죽이지 않는다. 무엇이 없는지는 requireTestEnv가 이름까지 짚어 말한다.
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * 없으면 **테스트를 통과시키지 않고 즉시 세운다.**
 *
 * 환경변수가 비면 supabase-js는 요청을 보내 보고 401로 실패하는데, 그 오류 문구는
 * "왜 실패했는지"를 말해 주지 않는다. 여기서 이름을 짚어 두면 한 번에 안다.
 */
export function requireTestEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(
      `통합 테스트에 ${name}가 필요합니다. .env.local에 값을 넣고 다시 실행하세요.`,
    );
  }

  return value;
}
