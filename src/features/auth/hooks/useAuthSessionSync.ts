import { useEffect } from 'react';
import { getCurrentSession, subscribeToAuthChanges } from '../api/authApi';
import { selectSetSession, useAuthStore } from '../store/authStore';

/**
 * 앱 시작 시 저장된 세션을 한 번 읽고, 이후 Supabase 인증 이벤트를 authStore에 동기화한다.
 * (로그인/로그아웃/토큰 갱신/OAuth 복귀 모두 이 구독으로 처리)
 */
export function useAuthSessionSync(): void {
  const setSession = useAuthStore(selectSetSession);

  useEffect(
    function syncAuthSession() {
      let isActive = true;

      async function loadInitialSession(): Promise<void> {
        const session = await getCurrentSession();
        if (isActive) {
          setSession(session);
        }
      }

      loadInitialSession().catch(function handleInitialSessionError() {
        // 세션 조회 실패는 비로그인으로 간주한다(로딩 상태에 갇히지 않도록).
        if (isActive) {
          setSession(null);
        }
      });

      const unsubscribe = subscribeToAuthChanges(function handleAuthChange(
        _event,
        session,
      ) {
        setSession(session);
      });

      return function cleanupAuthSync(): void {
        isActive = false;
        unsubscribe();
      };
    },
    [setSession],
  );
}
