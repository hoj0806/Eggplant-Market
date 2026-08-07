import type { AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../../../shared/lib/supabaseClient';
import type { AuthSession, EmailCredentials, SignUpResult } from '../types';

const OAUTH_REDIRECT_PATH = '/auth/callback';

/**
 * 비밀번호 재설정 링크가 떨어지는 곳. **`/auth/callback`과 갈라 둔다.**
 *
 * 그쪽은 세션이 서면 곧바로 홈으로 보내는 화면이라(`authCallbackPage`), 재설정 링크를
 * 거기로 보내면 **로그인만 되고 새 비밀번호를 정할 자리 없이 밀려난다.**
 * 링크가 데려다줄 곳은 "새 비밀번호를 정하는 화면"이어야 한다.
 */
const PASSWORD_RESET_PATH = '/reset-password';

function buildRedirectUrl(path: string = OAUTH_REDIRECT_PATH): string {
  return `${window.location.origin}${path}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * 이메일 회원가입. profiles 행은 DB 트리거(handle_new_user)가 자동 생성한다.
 * 이메일 확인이 켜져 있으면 session이 null로 돌아온다.
 */
export async function signUpWithEmail(
  credentials: EmailCredentials,
): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(credentials.email),
    password: credentials.password,
    options: { emailRedirectTo: buildRedirectUrl() },
  });

  if (error !== null) {
    throw error;
  }

  return { session: data.session, needsEmailConfirm: data.session === null };
}

export async function signInWithEmail(
  credentials: EmailCredentials,
): Promise<AuthSession> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(credentials.email),
    password: credentials.password,
  });

  if (error !== null) {
    throw error;
  }

  return data.session;
}

/** 구글 OAuth. 성공 시 브라우저가 구글 동의 화면으로 이동하므로 이후 코드는 실행되지 않는다. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: buildRedirectUrl() },
  });

  if (error !== null) {
    throw error;
  }
}

/**
 * 비밀번호 재설정 메일 보내기.
 *
 * **가입된 이메일인지 알려 주지 않는다.** Supabase는 없는 주소에도 성공으로 답하는데,
 * 그 편이 맞다 — 여기서 "가입되지 않은 이메일입니다"를 내면 **아무나 이메일을 넣어 보며
 * 누가 이 서비스를 쓰는지 알아낼 수 있다.** 그래서 이 함수는 성공/실패만 돌려주고,
 * 화면도 "가입된 주소라면 보냈다"로 적는다.
 *
 * 그래도 오류가 나는 경우는 있다 — 형식이 틀린 주소, 그리고 **메일 발송 한도**다.
 * 무료 티어 내장 SMTP는 한도가 낮아 `over_email_send_rate_limit`이 뜬다(그래서 이 프로젝트가
 * 한동안 Confirm email을 꺼 두었다). 커스텀 SMTP를 붙이면 그쪽 한도를 따른다.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: buildRedirectUrl(PASSWORD_RESET_PATH),
  });

  if (error !== null) {
    throw error;
  }
}

/**
 * 새 비밀번호 정하기. **재설정 링크로 들어와 세션이 선 다음에만 쓴다.**
 *
 * `accountApi.changePassword`와 달리 현재 비밀번호를 묻지 않는다 — 그 자리에서
 * 본인임을 증명한 것은 **메일함을 열었다는 사실**이다. 대신 그 증명이 실제로 있었는지를
 * 화면이 확인한다(`resetPasswordPage` · `PASSWORD_RECOVERY`).
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

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
