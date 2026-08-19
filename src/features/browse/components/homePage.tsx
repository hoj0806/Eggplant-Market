import BrandMark from '../../../shared/ui/brandMark';
import { ChevronRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import NeighborhoodPostList from './neighborhoodPostList';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import NotificationBellLink from '../../notification/components/notificationBellLink';
import ProfileAvatar from '../../profile/components/profileAvatar';
import GuestRegionSwitcher from '../../region/components/guestRegionSwitcher';
import { useMyProfileQuery } from '../../profile/hooks/useProfileQuery';
import { useActiveRegion } from '../hooks/useActiveRegion';
import type { Profile } from '../../profile/types';

/**
 * 비로그인 사용자에게 로그인을 권하는 자리.
 *
 * **목록을 대신하지 않고 목록 위에 얹는다.** 예전에는 이 안내가 글 목록이 있어야 할 자리를
 * 통째로 차지해서, 링크를 처음 누른 사람이 물건을 하나도 못 본 채 "시작하기"만 보고 떠났다.
 * 권하는 것과 보여주는 것은 자리를 다투는 사이가 아니다.
 *
 * 버튼이 하나다. 소셜 로그인만 남으면서 **가입과 로그인이 같은 행동**이 됐다 —
 * 둘을 나란히 두면 처음 온 사람이 무엇을 눌러야 할지 고르게 되는데, 고를 것이 없다.
 */
function GuestBanner() {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border
                 border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900
                 dark:bg-emerald-950"
    >
      <p className="text-sm text-gray-700 dark:text-gray-200">
        마음에 드는 물건이 있나요? 로그인하면 채팅으로 거래할 수 있어요.
      </p>
      <Link
        to="/login"
        className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white
                   transition hover:bg-emerald-700"
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
            <span className="inline-flex items-center gap-0.5">
              {profile?.region?.fullName ?? '동네 설정하기'}
              <ChevronRight size={14} />
            </span>
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

/**
 * 홈.
 *
 * **목록은 로그인 여부를 묻지 않는다.** 글 읽기는 `posts_select`가 `using (true)`라 서버가
 * 이미 누구에게나 열어 둔 자리이고, 화면만 닫혀 있었다. 닫아 두는 동안 링크를 처음 누른
 * 사람은 로고와 버튼 하나만 보고 떠났다.
 *
 * 동네는 `useActiveRegion`에게 묻는다. 로그인 사용자의 프로필·게스트가 고른 동네·아직
 * 아무것도 고르지 않은 사람의 기본 동네가 그 안에서 갈린다 — 여기서 다시 나누면
 * 검색 화면과 어긋난다.
 */
function HomePage() {
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const activeRegion = useActiveRegion();
  // 닉네임·아바타는 동네와 달리 이 화면에만 필요해서 프로필을 따로 읽는다.
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
          <span className="flex items-center gap-1.5">
            <BrandMark size={26} />
            가지마켓
          </span>
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
          <span className="flex items-center gap-2">
            <Search size={16} />
            물건 이름이나 내용으로 검색
          </span>
        </Link>
      </header>

      {activeRegion.isGuest ? <GuestBanner /> : null}

      {/*
        게스트에게는 동네 이름을 그대로 제목으로 쓴다. "우리 동네"는 그 동네가 자기 동네일 때만
        맞는 말이라, 대신 세워 준 동네를 보고 있는 사람에게는 어긋난다.
      */}
      {activeRegion.isGuest && activeRegion.region !== null ? (
        <GuestRegionSwitcher
          region={activeRegion.region}
          isDefaultRegion={activeRegion.isDefaultRegion}
          onRegionSelect={activeRegion.setGuestRegion}
        />
      ) : null}

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        {activeRegion.isGuest && activeRegion.region !== null
          ? `${activeRegion.region.depth3} 중고거래`
          : '우리 동네 중고거래'}
      </h2>

      {/*
        동네를 확인하는 중에는 목록을 그리지 않는다. 그리면 아직 모르는 것을 "동네가 없다"로
        읽어 안내 문구가 한 번 번쩍인다.
      */}
      {activeRegion.isLoading ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          동네를 확인하는 중입니다…
        </p>
      ) : (
        <NeighborhoodPostList regionCode={activeRegion.region?.code ?? null} />
      )}
    </main>
  );
}

export default HomePage;
