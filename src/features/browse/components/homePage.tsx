import { Link } from 'react-router-dom';
import NeighborhoodPostList from './neighborhoodPostList';
import LogoutButton from '../../auth/components/logoutButton';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import ChatEntryLink from '../../chat/components/chatEntryLink';
import ProfileAvatar from '../../profile/components/profileAvatar';
import { useMyProfileQuery } from '../../profile/hooks/useProfileQuery';
import type { Profile } from '../../profile/types';

function GuestActions() {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <p className="text-gray-600 dark:text-gray-300">
        로그인하고 우리 동네 중고거래를 시작해 보세요.
      </p>
      <div className="flex gap-2">
        <Link
          to="/login"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          로그인
        </Link>
        <Link
          to="/signup"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700
                     transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          회원가입
        </Link>
      </div>
    </div>
  );
}

/** 온보딩에서 정한 닉네임·프로필 사진과 지금 보고 있는 동네를 보여준다. */
function MemberGreeting(props: { profile: Profile | undefined; viewerId: string }) {
  const profile = props.profile;

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <ProfileAvatar
          nickname={profile?.nickname ?? ''}
          avatarUrl={profile?.avatarUrl ?? null}
          size="md"
        />
        <div className="flex flex-col">
          <p className="text-gray-600 dark:text-gray-300">
            <span className="font-semibold">{profile?.nickname ?? '이웃'}</span>님, 반갑습니다.
          </p>
          <Link
            to="/settings/region"
            className="text-sm text-emerald-700 transition hover:underline dark:text-emerald-400"
          >
            {profile?.region?.fullName ?? '동네 설정하기'} ›
          </Link>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ChatEntryLink viewerId={props.viewerId} />
        <LogoutButton />
      </div>
    </div>
  );
}

function HomePage() {
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  // 목록을 그리려면 내 동네를 알아야 해서 프로필을 화면 맨 위에서 읽는다.
  const profileQuery = useMyProfileQuery(status === 'authenticated' ? (user?.id ?? null) : null);

  const isMember = status === 'authenticated';

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-4 p-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">🍆 가지마켓</h1>

        {status === 'loading' ? (
          <p className="text-gray-600 dark:text-gray-300">세션을 확인하는 중입니다…</p>
        ) : null}

        {isMember && user !== null ? (
          <MemberGreeting profile={profileQuery.data} viewerId={user.id} />
        ) : null}

        {/* 검색은 비로그인도 쓸 수 있어 로그인 여부와 상관없이 보여준다. */}
        <Link
          to="/search"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-400
                     transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900
                     dark:text-gray-500 dark:hover:bg-gray-800"
        >
          🔍 물건 이름이나 내용으로 검색
        </Link>
      </header>

      {isMember ? (
        <>
          <section className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              우리 동네 중고거래
            </h2>
            <Link
              to="/posts/new"
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              + 글쓰기
            </Link>
          </section>

          <NeighborhoodPostList regionCode={profileQuery.data?.region?.code ?? null} />
        </>
      ) : null}

      {status === 'unauthenticated' ? <GuestActions /> : null}
    </main>
  );
}

export default HomePage;
