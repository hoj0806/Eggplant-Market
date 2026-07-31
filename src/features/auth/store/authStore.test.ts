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
});
