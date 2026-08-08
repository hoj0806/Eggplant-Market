import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useMyProfileQuery } from '../hooks/useProfileQuery';
import { isOnboardingComplete } from '../utils/onboardingStatus';

type RequireOnboardingProps = {
  children: ReactNode;
};

/**
 * 온보딩을 마치지 않은 로그인 사용자를 온보딩 화면으로 보낸다.
 * 비로그인 사용자는 그대로 통과시킨다(홈은 게스트에게도 보여야 하므로).
 * 프로필 조회에 실패하면 막지 않고 통과시킨다 — 조회 실패로 앱 전체가 잠기는 편이 더 나쁘다.
 */
function RequireOnboarding(props: RequireOnboardingProps) {
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const profileQuery = useMyProfileQuery(status === 'authenticated' ? (user?.id ?? null) : null);

  if (status === 'authenticated') {
    if (profileQuery.isLoading) {
      return <PageSpinner message="프로필을 불러오는 중입니다…" />;
    }
    if (profileQuery.data !== undefined && !isOnboardingComplete(profileQuery.data)) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{props.children}</>;
}

export default RequireOnboarding;
