import { create } from 'zustand';
import type { AuthSession, AuthStatus, AuthUser } from '../types';

type AuthStoreState = {
  session: AuthSession | null;
  user: AuthUser | null;
  status: AuthStatus;
  /**
   * 지금 세션이 **비밀번호 재설정 링크로 선 것인가.**
   *
   * 세션만으로는 가릴 수 없어 따로 기억한다. 이 값이 없으면 `/reset-password`가
   * "로그인돼 있으면 통과"가 되는데, 그러면 **남이 열어 둔 브라우저로 비밀번호를 바꿔
   * 계정을 가져갈 수 있다** — `accountApi.changePassword`가 현재 비밀번호를 다시 묻는
   * 이유가 그것이고, 여기서는 메일함을 열었다는 증명이 그 자리를 대신한다.
   *
   * 새로고침하면 사라진다(메모리다). 그때는 링크를 다시 받게 된다 — 잃는 쪽으로 틀린다.
   */
  isPasswordRecovery: boolean;
  setSession(session: AuthSession | null): void;
  clearSession(): void;
  beginPasswordRecovery(): void;
  endPasswordRecovery(): void;
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
    isPasswordRecovery: false,
    setSession(session) {
      // 재설정 표는 여기서 건드리지 않는다. 재설정 링크로 들어오면 세션이 먼저 서고
      // 그 다음에 PASSWORD_RECOVERY가 오는데, 여기서 끄면 방금 켠 표를 스스로 지운다.
      set(toSnapshot(session));
    },
    clearSession() {
      set({ ...toSnapshot(null), isPasswordRecovery: false });
    },
    beginPasswordRecovery() {
      set({ isPasswordRecovery: true });
    },
    endPasswordRecovery() {
      set({ isPasswordRecovery: false });
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

export function selectIsPasswordRecovery(state: AuthStoreState): boolean {
  return state.isPasswordRecovery;
}

export function selectBeginPasswordRecovery(
  state: AuthStoreState,
): AuthStoreState['beginPasswordRecovery'] {
  return state.beginPasswordRecovery;
}

export function selectEndPasswordRecovery(
  state: AuthStoreState,
): AuthStoreState['endPasswordRecovery'] {
  return state.endPasswordRecovery;
}
