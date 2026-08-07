import { Link } from 'react-router-dom';
import NeighborhoodPostList from './neighborhoodPostList';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import NotificationBellLink from '../../notification/components/notificationBellLink';
import ProfileAvatar from '../../profile/components/profileAvatar';
import { useMyProfileQuery } from '../../profile/hooks/useProfileQuery';
import type { Profile } from '../../profile/types';

function GuestActions() {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <p className="text-gray-600 dark:text-gray-300">
        로그인하고 우리 동네 중고거래를 시작해 보세요.
      </p>
      {/*
        버튼이 하나다. 소셜 로그인만 남으면서 **가입과 로그인이 같은 행동**이 됐다 —
        둘을 나란히 두면 처음 온 사람이 무엇을 눌러야 할지 고르게 되는데, 고를 것이 없다.
      */}
      <Link
        to="/login"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        시작하기
      </Link>
    </div>
  );
}

/**
 * 온보딩에서 정한 닉네임·프로필 사진과 지금 보고 있는 동네를 보여준다.
 *
 * 사진과 이름은 마이페이지로 가는 길이다 — 로그아웃도 그리로 옮겼다.
 * 홈 헤더에 두면 자주 쓰지 않는 버튼이 검색·글쓰기 자리를 계속 차지한다.
 *
 * 채팅 입구는 탭바로 옮겼다. 안 읽은 배지도 그리로 따라갔다 —
 * 같은 숫자를 두 곳에 그리면 한쪽만 늦게 갱신될 때 어느 쪽이 맞는지 알 수 없다.
 *
 * 알림 종은 반대로 여기 남는다. 탭바는 다섯 칸으로 이미 좁고, 알림은 "하러 가는 곳"이 아니라
 * "왔을 때 가는 곳"이라 늘 자리를 차지할 이유가 적다. 배지가 한 곳뿐인 것은 채팅과 같다.
 */
function MemberGreeting(props: { profile: Profile | undefined; viewerId: string }) {
  const profile = props.profile;

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/my" aria-label="마이페이지" className="shrink-0">
          <ProfileAvatar
            nickname={profile?.nickname ?? ''}
            avatarUrl={profile?.avatarUrl ?? null}
            size="md"
          />
        </Link>
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-gray-600 dark:text-gray-300">
            <Link to="/my" className="font-semibold transition hover:underline">
              {profile?.nickname ?? '이웃'}
            </Link>
            님, 반갑습니다.
          </p>
          <Link
            to="/settings/region"
            className="text-sm text-emerald-700 transition hover:underline dark:text-emerald-400"
          >
            {profile?.region?.fullName ?? '동네 설정하기'} ›
          </Link>
        </div>
      </div>

      {/*
        데스크탑에서는 같은 종이 상단 내비게이션에 있다. 배지가 한 화면에 둘이면
        어느 쪽이 맞는지 알 수 없어(그 판단은 탭바에도 같게 적혀 있다) 여기를 감춘다.
      */}
      <span className="md:hidden">
        <NotificationBellLink viewerId={props.viewerId} />
      </span>
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
    <main className="flex page-wide flex-col gap-4 p-6">
      <header className="flex flex-col gap-4">
        {/*
          데스크탑에서는 상단 내비게이션이 로고를 이미 들고 있다. 둘을 함께 두면
          같은 이름이 세로로 두 번 쌓인다.
        */}
        <h1 className="text-2xl font-bold text-emerald-600 md:hidden dark:text-emerald-400">
          🍆 가지마켓
        </h1>

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
          {/* 글쓰기 버튼은 탭바로 옮겼다. 어느 화면에서든 같은 자리에 있는 편이 찾기 쉽다. */}
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            우리 동네 중고거래
          </h2>

          <NeighborhoodPostList regionCode={profileQuery.data?.region?.code ?? null} />
        </>
      ) : null}

      {status === 'unauthenticated' ? <GuestActions /> : null}
    </main>
  );
}

export default HomePage;
