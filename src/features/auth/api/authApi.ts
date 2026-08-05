import type { AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../../../shared/lib/supabaseClient';
import type { AuthSession, EmailCredentials, SignUpResult } from '../types';

const OAUTH_REDIRECT_PATH = '/auth/callback';

function buildRedirectUrl(): string {
  return `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
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
