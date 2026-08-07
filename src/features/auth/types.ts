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

/**
 * 재설정 링크로 들어와 새 비밀번호만 정할 때의 값.
 *
 * `SignUpValues`에서 이메일을 뺀 모양인데 그렇다고 적지는 않았다 —
 * 여기서 이메일을 안 묻는 이유는 **링크가 이미 누구인지 말해 주기 때문**이지
 * 가입 값에서 한 칸을 덜어낸 것이 아니다.
 */
export type NewPasswordValues = {
  password: string;
  passwordConfirm: string;
};

export type AuthFieldName = 'email' | 'password' | 'passwordConfirm';

export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>;

export type SignUpResult = {
  session: AuthSession | null;
  /** Supabase에서 이메일 확인이 켜져 있으면 세션 없이 가입만 완료된다. */
  needsEmailConfirm: boolean;
};
