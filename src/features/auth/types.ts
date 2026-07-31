import type { Session, User } from '@supabase/supabase-js';

export type AuthSession = Session;
export type AuthUser = User;

/** 세션 확인 전에는 'loading'. 화면 깜빡임(로그인 화면 잠깐 노출)을 막기 위해 구분한다. */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type EmailCredentials = {
  email: string;
  password: string;
};

export type SignUpValues = EmailCredentials & {
  passwordConfirm: string;
};

export type AuthFieldName = 'email' | 'password' | 'passwordConfirm';

export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>;

export type SignUpResult = {
  session: AuthSession | null;
  /** Supabase에서 이메일 확인이 켜져 있으면 세션 없이 가입만 완료된다. */
  needsEmailConfirm: boolean;
};
