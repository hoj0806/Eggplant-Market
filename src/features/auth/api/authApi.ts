import type { AuthChangeEvent, Provider } from '@supabase/supabase-js';
import { supabase } from '../../../shared/lib/supabaseClient';
import type { AuthSession, SocialProvider } from '../types';

const OAUTH_REDIRECT_PATH = '/auth/callback';

function buildRedirectUrl(): string {
  return `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
}

/**
 * 소셜 로그인.
 *
 * **가입과 로그인을 가르지 않는다.** OAuth는 처음 온 사람이면 계정을 만들고 이미 있으면
 * 그대로 들여보내므로, 화면에서 "가입"과 "로그인"을 나눠 물을 것이 없다 —
 * 이메일 로그인을 걷어내면서 `/signup`이 사라진 이유가 이것이다.
 * `profiles` 행은 DB 트리거(`handle_new_user`)가 어느 쪽이든 만들어 준다.
 *
 * 성공하면 브라우저가 그 서비스의 동의 화면으로 옮겨 가므로 **이 뒤의 코드는 실행되지 않는다.**
 * 돌아오는 곳은 `/auth/callback`이다.
 *
 * 아직 Supabase에서 켜지 않은 프로바이더를 부르면 `provider is not enabled`가 오고,
 * `authErrorMessage`가 "해당 소셜 로그인이 아직 활성화되지 않았습니다"로 옮긴다.
 */
export async function signInWithSocial(provider: SocialProvider): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    // SocialProvider는 Provider의 부분집합이다. 우리가 쓰는 둘만 쓰도록 좁혀 둔 이름이라
    // 여기서 원래 타입으로 되돌려 넘긴다.
    provider: provider as Provider,
    options: { redirectTo: buildRedirectUrl() },
  });

  if (error !== null) {
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error !== null) {
    throw error;
  }
}

/**
 * 이 기기의 토큰만 지운다(서버에 로그아웃을 알리지 않는다).
 *
 * 회원탈퇴 직후에 쓴다. 그때는 계정이 이미 없어서 보통 로그아웃(`scope: 'global'`)이
 * 401로 실패하고, 실패하면 supabase-js가 저장소의 토큰을 남겨 둔다 —
 * 새로고침하면 죽은 세션으로 다시 서는 자리다.
 */
export async function signOutLocally(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });

  if (error !== null) {
    throw error;
  }
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error !== null) {
    throw error;
  }

  return data.session;
}

export function subscribeToAuthChanges(
  handler: (event: AuthChangeEvent, session: AuthSession | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange(handler);

  return function unsubscribe(): void {
    data.subscription.unsubscribe();
  };
}
