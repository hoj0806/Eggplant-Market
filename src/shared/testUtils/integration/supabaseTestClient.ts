import { createClient } from '@supabase/supabase-js';
import { loadTestEnv, requireTestEnv } from './loadTestEnv';

loadTestEnv();

/**
 * 통합 테스트가 쓰는 Supabase 클라이언트.
 *
 * **`shared/lib/supabaseClient`를 대신한다.** jest 설정의 moduleNameMapper가 그 경로를
 * 이 파일로 바꿔치기하므로, `postApi`·`categoryApi` 같은 앱 코드를 **고치지 않고 그대로**
 * 부를 수 있다. 테스트가 SQL을 새로 쓰지 않고 **화면이 실제로 부르는 함수**를 밟는다는 뜻이다.
 *
 * 왜 앱 모듈을 그대로 못 쓰는가: 그쪽은 `import.meta.env`(Vite)로 값을 읽는데
 * ts-jest는 CommonJS로 옮기므로 `import.meta`가 문법 오류가 된다(`troble.md` #5).
 * 경로만 갈아끼우면 그 벽을 우회하면서도 검증 대상은 진짜 앱 코드로 남는다.
 *
 * 세션을 저장하지 않는다 — Node에는 localStorage가 없고, 테스트끼리 로그인 상태가
 * 새어 나가면 "익명일 때 안 보인다"는 검증이 조용히 무의미해진다.
 */
export const supabase = createClient(
  requireTestEnv('VITE_SUPABASE_URL'),
  requireTestEnv('VITE_SUPABASE_ANON_KEY'),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
