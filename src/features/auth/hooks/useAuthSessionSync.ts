import { useEffect } from 'react';
import { getCurrentSession, subscribeToAuthChanges } from '../api/authApi';
import {
  selectBeginPasswordRecovery,
  selectSetSession,
  useAuthStore,
} from '../store/authStore';

/**
 * 앱 시작 시 저장된 세션을 한 번 읽고, 이후 Supabase 인증 이벤트를 authStore에 동기화한다.
 * (로그인/로그아웃/토큰 갱신/OAuth 복귀 모두 이 구독으로 처리)
 *
 * **구독을 세션 읽기보다 먼저 건다.** supabase-js는 초기화 중에 생긴 알림을 곧바로
 * 흘리지 않고 큐에 담았다가 **초기화가 끝난 뒤 그때 등록돼 있는 구독자에게** 흘려보낸다
 * (`GoTrueClient`의 `_pendingInitNotifications`). 비밀번호 재설정 링크로 들어온 경우의
 * `PASSWORD_RECOVERY`가 그 큐를 타므로, 늦게 구독하면 **그 사건을 통째로 놓친다.**
 * 놓치면 `/reset-password`가 "링크가 만료됐다"고 말하게 된다 — 잃는 쪽으로 틀리기는 하지만
 * 정상 흐름이 막히므로, 순서를 뒤집는 것만으로 피할 수 있는 일은 피한다.
 */
export function useAuthSessionSync(): void {
  const setSession = useAuthStore(selectSetSession);
  const beginPasswordRecovery = useAuthStore(selectBeginPasswordRecovery);

  useEffect(
    function syncAuthSession() {
      let isActive = true;

      const unsubscribe = subscribeToAuthChanges(function handleAuthChange(
        event,
        session,
      ) {
        setSession(session);

        // 이 사건이 곧 "메일함을 열었다"는 증명이다. 세션만 보고는 가릴 수 없어 따로 남긴다.
        if (event === 'PASSWORD_RECOVERY') {
          beginPasswordRecovery();
        }
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
    [setSession, beginPasswordRecovery],
  );
}
