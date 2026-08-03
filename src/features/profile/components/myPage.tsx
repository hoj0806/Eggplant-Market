import { Link } from 'react-router-dom';
import MyPageMenu from './myPageMenu';
import MyProfileCard from './myProfileCard';
import PageSpinner from '../../../shared/ui/pageSpinner';
import LogoutButton from '../../auth/components/logoutButton';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useMyProfileQuery } from '../hooks/useProfileQuery';

/**
 * 마이페이지 — 내 정보와 내가 남긴 흔적으로 가는 입구.
 *
 * 목록 자체는 여기 없다. 넷 다 각자의 주소를 가진 화면이라 링크만 둔다 —
 * 탭으로 묶으면 새로고침·뒤로가기에서 어느 목록을 보던 중이었는지 잃는다.
 *
 * 로그인 가드는 라우터의 RequireMember가 이미 걸었다.
 */
function MyPage() {
  const user = useAuthStore(selectAuthUser);
  const profileQuery = useMyProfileQuery(user?.id ?? null);

  if (profileQuery.isLoading || profileQuery.data === undefined) {
    return <PageSpinner message="프로필을 불러오는 중입니다…" />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">나의 가지마켓</h1>
        <Link
          to="/"
          className="text-sm text-gray-500 transition hover:text-gray-700
                     dark:text-gray-400 dark:hover:text-gray-200"
        >
          홈으로 →
        </Link>
      </header>

      <MyProfileCard profile={profileQuery.data} />

      <MyPageMenu />

      <div className="pt-2">
        <LogoutButton />
      </div>
    </main>
  );
}

export default MyPage;
