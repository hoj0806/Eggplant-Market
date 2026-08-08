import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadTestEnv, requireTestEnv } from './loadTestEnv';

loadTestEnv();

/**
 * 테스트가 **자기 데이터를 심고 치우기 위한** 클라이언트. RLS를 지나간다.
 *
 * 왜 필요한가: 익명 클라이언트는 정책 때문에 아무것도 못 쓴다(그게 맞다). 그래서 테스트가
 * 남이 손으로 넣어 둔 데이터에 기대게 되는데, 화면을 만지며 글 하나만 지워도 무더기로 빨개진다.
 * **심고 → 확인하고 → 치우는** 테스트만이 되풀이해서 돌릴 수 있다.
 *
 * **검증에는 쓰지 않는다.** 이 키로 읽으면 정책이 꺼지므로 "안 보여야 할 것이 안 보인다"를
 * 확인할 수 없다. 심는 것은 여기, 확인은 언제나 익명 클라이언트(`supabaseTestClient`)다.
 *
 * ── 키 이름에 `VITE_`를 붙이지 않는다 ─────────────────────────────────
 * Vite는 `VITE_`로 시작하는 값을 **번들에 그대로 넣는다.** 서비스 키가 거기 들어가면
 * 브라우저를 여는 누구나 RLS를 지나갈 수 있다. 이름을 가르는 것만으로 그 사고가 막힌다.
 */

const SERVICE_ROLE_ENV = 'SUPABASE_SERVICE_ROLE_KEY';

let cached: SupabaseClient | null = null;

/** 서비스 키가 준비돼 있는가. 없으면 씨앗이 필요한 테스트를 세운다. */
export function hasAdminAccess(): boolean {
  const key = process.env[SERVICE_ROLE_ENV];

  return key !== undefined && key !== '';
}

export function getAdminClient(): SupabaseClient {
  if (cached !== null) {
    return cached;
  }

  if (!hasAdminAccess()) {
    throw new Error(
      [
        `이 테스트는 씨앗 데이터를 직접 심으므로 ${SERVICE_ROLE_ENV}가 필요합니다.`,
        '',
        'Supabase 대시보드 → Project Settings → API → service_role 키를 복사해',
        '.env.local에 아래 한 줄을 더하세요 (VITE_ 접두사를 붙이면 안 됩니다):',
        '',
        `  ${SERVICE_ROLE_ENV}=eyJ...`,
        '',
        '.env.local은 이미 gitignore되어 있어 저장소에 올라가지 않습니다.',
      ].join('\n'),
    );
  }

  cached = createClient(
    requireTestEnv('VITE_SUPABASE_URL'),
    requireTestEnv(SERVICE_ROLE_ENV),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );

  return cached;
}
