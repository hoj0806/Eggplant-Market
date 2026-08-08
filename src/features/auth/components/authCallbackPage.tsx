import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { selectAuthStatus, useAuthStore } from '../store/authStore';

/**
 * 구글 OAuth·이메일 인증 링크의 리다이렉트 착지 지점.
 * supabase-js가 URL의 토큰을 세션으로 교환하면 useAuthSessionSync가 상태를 갱신하고,
 * 그 결과에 따라 홈 또는 로그인 화면으로 보낸다.
 */
function AuthCallbackPage() {
  const navigate = useNavigate();
  const status = useAuthStore(selectAuthStatus);

  useEffect(
    function redirectWhenSessionResolved() {
      if (status === 'loading') {
        return;
      }
      navigate(status === 'authenticated' ? '/' : '/login', { replace: true });
    },
    [status, navigate],
  );

  return (
    <main
      role="status"
      className="flex min-h-screen page-narrow flex-col items-center justify-center gap-3 p-6"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      <p className="text-sm text-gray-600 dark:text-gray-400">로그인 처리 중입니다…</p>
    </main>
  );
}

export default AuthCallbackPage;
