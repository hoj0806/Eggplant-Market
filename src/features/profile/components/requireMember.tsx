import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, useAuthStore } from '../../auth/store/authStore';

type RequireMemberProps = {
  children: ReactNode;
};

/**
 * 로그인하지 않았으면 로그인 화면으로 보낸다.
 *
 * RequireOnboarding과 역할이 다르다. 그쪽은 "동네를 정했는가"를 보며 게스트는 통과시킨다 —
 * 홈·검색·게시물 상세는 게스트에게도 보여야 하기 때문이다.
 * 마이페이지는 내 것을 보는 자리라 게스트에게 보여줄 것이 없다. 그래서 한 겹이 더 필요하다.
 *
 * 채팅 화면들은 이 판단을 화면 안에 직접 적어 두었다. 마이페이지는 화면이 여섯이라
 * 같은 열 줄을 여섯 번 적는 대신 감싸는 컴포넌트로 뽑는다.
 */
function RequireMember(props: RequireMemberProps) {
  const status = useAuthStore(selectAuthStatus);

  if (status === 'loading') {
    return <PageSpinner message="세션을 확인하는 중입니다…" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{props.children}</>;
}

export default RequireMember;
