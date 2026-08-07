import { create } from 'zustand';
import type { AuthSession, AuthStatus, AuthUser } from '../types';

type AuthStoreState = {
  session: AuthSession | null;
  user: AuthUser | null;
  status: AuthStatus;
  setSession(session: AuthSession | null): void;
  clearSession(): void;
};

type AuthSnapshot = Pick<AuthStoreState, 'session' | 'user' | 'status'>;

export const AUTH_INITIAL_STATE: AuthSnapshot = {
  session: null,
  user: null,
  status: 'loading',
};

function toSnapshot(session: AuthSession | null): AuthSnapshot {
  if (session === null) {
    return { session: null, user: null, status: 'unauthenticated' };
  }
  return { session, user: session.user, status: 'authenticated' };
}

export const useAuthStore = create<AuthStoreState>(function initAuthStore(set) {
  return {
    ...AUTH_INITIAL_STATE,
    setSession(session) {
      set(toSnapshot(session));
    },
    clearSession() {
      set(toSnapshot(null));
    },
  };
});

export function selectAuthStatus(state: AuthStoreState): AuthStatus {
  return state.status;
}

export function selectAuthUser(state: AuthStoreState): AuthUser | null {
  return state.user;
}

export function selectSetSession(state: AuthStoreState): AuthStoreState['setSession'] {
  return state.setSession;
}

export function selectClearSession(state: AuthStoreState): AuthStoreState['clearSession'] {
  return state.clearSession;
}
