import { useEffect } from 'react';
import { getCurrentSession, subscribeToAuthChanges } from '../api/authApi';
import { selectSetSession, useAuthStore } from '../store/authStore';

/**
 * 앱 시작 시 저장된 세션을 한 번 읽고, 이후 Supabase 인증 이벤트를 authStore에 동기화한다.
 * (소셜 로그인 복귀 / 로그아웃 / 토큰 갱신 모두 이 구독으로 처리)
 *
 * **구독을 세션 읽기보다 먼저 건다.** supabase-js는 초기화 중에 생긴 알림을 곧바로 흘리지
 * 않고 큐에 담았다가 **초기화가 끝난 뒤 그때 등록돼 있는 구독자에게** 흘려보낸다
 * (`GoTrueClient`의 `_pendingInitNotifications`). OAuth로 돌아왔을 때의 `SIGNED_IN`이
 * 그 큐를 타므로, 늦게 구독하면 그 사건을 놓친다.
 *
 * 지금은 놓쳐도 아래 `getCurrentSession()`이 같은 세션을 읽어 와 화면은 멀쩡하다.
 * 그래도 순서를 이렇게 두는 이유는 **"사건으로 알아야만 하는 것"이 생기는 순간 조용히
 * 어긋나기 때문**이다 — 실제로 한 번 겪은 자리다(`troble.md`).
 */
export function useAuthSessionSync(): void {
  const setSession = useAuthStore(selectSetSession);

  useEffect(
    function syncAuthSession() {
      let isActive = true;

      const unsubscribe = subscribeToAuthChanges(function handleAuthChange(
        _event,
        session,
      ) {
        setSession(session);
      });

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

      return function cleanupAuthSync(): void {
        isActive = false;
        unsubscribe();
      };
    },
    [setSession],
  );
}
