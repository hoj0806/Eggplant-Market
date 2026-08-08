import MyPageMenu from './myPageMenu';
import MyProfileCard from './myProfileCard';
import PageSpinner from '../../../shared/ui/pageSpinner';
import ThemeToggle from '../../../shared/ui/themeToggle';
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
    <main className="flex page-wide flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">나의 가지마켓</h1>
      </header>

      <MyProfileCard profile={profileQuery.data} />

      <MyPageMenu />

      {/* 테마는 계정이 아니라 이 기기의 설정이라 목록(MyPageMenu)이 아니라 여기 직접 놓는다. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">화면 테마</h2>
        <ThemeToggle />
      </section>

      <div className="pt-2">
        <LogoutButton />
      </div>
    </main>
  );
}

export default MyPage;
