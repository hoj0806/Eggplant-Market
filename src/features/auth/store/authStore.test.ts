import { AUTH_INITIAL_STATE, useAuthStore } from './authStore';
import type { AuthSession } from '../types';

// Supabase가 돌려주는 세션 객체의 최소 형태(테스트 픽스처).
function createSession(userId: string, email: string): AuthSession {
  return {
    access_token: `access-${userId}`,
    refresh_token: `refresh-${userId}`,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2026-08-01T00:00:00.000Z',
    },
  };
}

describe('authStore', function authStoreSuite() {
  beforeEach(function resetStore() {
    useAuthStore.setState(AUTH_INITIAL_STATE);
  });

  it('초기 상태는 loading이며 세션이 없다', function initialCase() {
    const state = useAuthStore.getState();
    expect(state.status).toBe('loading');
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
  });

  it('세션을 넣으면 authenticated가 되고 user를 꺼내 둔다', function setSessionCase() {
    const session = createSession('user-1', 'eggplant@example.com');

    useAuthStore.getState().setSession(session);

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.session).toBe(session);
    expect(state.user?.email).toBe('eggplant@example.com');
  });

  it('null 세션을 넣으면 unauthenticated가 된다 (loading과 구분)', function setNullSessionCase() {
    useAuthStore.getState().setSession(null);

    const state = useAuthStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.user).toBeNull();
  });

  it('clearSession은 로그인 상태를 비운다', function clearSessionCase() {
    useAuthStore.getState().setSession(createSession('user-2', 'neighbor@example.com'));
    useAuthStore.getState().clearSession();

    const state = useAuthStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
  });

  // --- 비밀번호 재설정 표 -------------------------------------------------

  // 재설정 링크로 들어오면 세션이 **먼저** 서고 그다음에 PASSWORD_RECOVERY가 온다.
  // setSession이 표를 끄면 방금 켠 것을 스스로 지운다.
  it('세션을 다시 넣어도 재설정 표는 꺼지지 않는다', function keepRecoveryCase() {
    useAuthStore.getState().beginPasswordRecovery();
    useAuthStore.getState().setSession(createSession('user-3', 'forgot@example.com'));

    expect(useAuthStore.getState().isPasswordRecovery).toBe(true);
  });

  // 한 번 받은 링크가 계속 열려 있으면 몇 번이고 비밀번호를 바꿀 수 있는 창이 된다.
  it('endPasswordRecovery는 그 창을 닫는다', function endRecoveryCase() {
    useAuthStore.getState().beginPasswordRecovery();
    useAuthStore.getState().endPasswordRecovery();

    expect(useAuthStore.getState().isPasswordRecovery).toBe(false);
  });

  it('로그아웃하면 재설정 표도 함께 사라진다', function clearRecoveryCase() {
    useAuthStore.getState().beginPasswordRecovery();
    useAuthStore.getState().clearSession();

    expect(useAuthStore.getState().isPasswordRecovery).toBe(false);
  });
});
