import type { ReactNode } from 'react';
import { useAuthSessionSync } from '../hooks/useAuthSessionSync';

type AuthSessionProviderProps = {
  children: ReactNode;
};

/** Supabase 세션을 authStore에 동기화하는 구독을 앱 전역에 한 번만 건다. */
function AuthSessionProvider(props: AuthSessionProviderProps) {
  useAuthSessionSync();

  return <>{props.children}</>;
}

export default AuthSessionProvider;
