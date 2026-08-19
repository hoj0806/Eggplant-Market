import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import HomePage from './homePage';
import { AUTH_INITIAL_STATE, useAuthStore } from '../../auth/store/authStore';
import { useActiveRegionStore } from '../../region/store/activeRegionStore';
import { DEFAULT_GUEST_REGION } from '../../region/utils/defaultGuestRegion';
import type { AuthUser } from '../../auth/types';
import type { PostSummary } from '../../post/types';

/**
 * 홈 — **비로그인 사용자에게 글 목록이 그려지는가.**
 *
 * 이 화면이 오래 지키지 못한 것이 정확히 이것이다. 목록을 `isMember`로 감싸 두는 바람에
 * 링크를 처음 누른 사람은 로고와 "시작하기" 버튼만 보고 떠났다. 서버는 그동안 내내
 * 열려 있었다(`posts_select`가 `using (true)`) — 닫혀 있던 것은 화면뿐이었다.
 *
 * api 계층은 mock한다. 그쪽이 supabaseClient(=import.meta)에 닿아 ts-jest에서 못 읽힌다
 * (architecture.md §6 · troble.md 「탐색」 1번).
 */
const mockNeighborhoodPostsQuery = jest.fn();

jest.mock('../../post/hooks/usePostQueries', function mockPostQueries() {
  return {
    useNeighborhoodPostsQuery: function useNeighborhoodPostsQuery(regionCode: string | null) {
      return mockNeighborhoodPostsQuery(regionCode);
    },
  };
});

jest.mock('../../profile/hooks/useProfileQuery', function mockProfileQuery() {
  return {
    useMyProfileQuery: function useMyProfileQuery() {
      return { data: undefined, isLoading: false };
    },
  };
});

// 알림 종은 안 읽은 수를 세러 서버에 간다. 이 화면의 질문과 상관이 없어 통째로 끈다.
jest.mock('../../notification/components/notificationBellLink', function mockBell() {
  return {
    __esModule: true,
    default: function NotificationBellLink() {
      return null;
    },
  };
});

// 동네 선택 위젯은 카카오 SDK 로더를 달고 온다. 여기서는 **그 자리가 있는지**만 물으면 된다.
jest.mock('../../region/components/guestRegionSwitcher', function mockSwitcher() {
  return {
    __esModule: true,
    default: function GuestRegionSwitcher(props: { region: { fullName: string } }) {
      return <div data-testid="guest-region-switcher">{props.region.fullName}</div>;
    },
  };
});

function makePost(id: number, title: string): PostSummary {
  return {
    id,
    title,
    price: 10000,
    status: 'selling',
    thumbnailUrl: null,
    dongName: DEFAULT_GUEST_REGION.fullName,
    likeCount: 0,
    viewCount: 0,
    commentCount: 0,
    bumpedAt: '2026-08-13T00:00:00.000Z',
    distanceM: null,
  };
}

function renderHome(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{props.children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  render(<HomePage />, { wrapper: Wrapper });
}

beforeEach(function resetStores(): void {
  // 호출 기록까지 지운다. 안 지우면 "부르지 않는다"를 묻는 검사가 앞 테스트의 호출을 센다.
  jest.clearAllMocks();
  mockNeighborhoodPostsQuery.mockReturnValue({
    data: { pages: [[makePost(1, '아이패드 9세대'), makePost(2, '캡슐 커피머신')]] },
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
  });
  useAuthStore.setState(AUTH_INITIAL_STATE);
  useActiveRegionStore.setState({ guestRegion: null });
  localStorage.clear();
});

describe('HomePage', function homePageSuite() {
  it('비로그인 사용자에게도 글 목록을 그린다', function showsPostsToGuest() {
    useAuthStore.setState({ status: 'unauthenticated', user: null, session: null });

    renderHome();

    expect(screen.getByText('아이패드 9세대')).toBeInTheDocument();
    expect(screen.getByText('캡슐 커피머신')).toBeInTheDocument();
  });

  it('동네를 고른 적 없는 게스트에게는 기본 동네로 목록을 부른다', function usesDefaultRegion() {
    useAuthStore.setState({ status: 'unauthenticated', user: null, session: null });

    renderHome();

    expect(mockNeighborhoodPostsQuery).toHaveBeenCalledWith(DEFAULT_GUEST_REGION.code);
  });

  it('목록을 보여주면서 로그인도 함께 권한다', function keepsSignInCallToAction() {
    // 권하는 것과 보여주는 것은 자리를 다투는 사이가 아니다. 예전에는 배너가 목록을 대신했다.
    useAuthStore.setState({ status: 'unauthenticated', user: null, session: null });

    renderHome();

    expect(screen.getByRole('link', { name: '시작하기' })).toBeInTheDocument();
    expect(screen.getByText('아이패드 9세대')).toBeInTheDocument();
  });

  it('게스트에게는 동네를 바꿀 자리를 낸다', function offersRegionSwitch() {
    // 기본 동네를 세우면 SearchRegionPrompt가 영영 안 뜬다. 바꿀 길이 여기 없으면 아예 없다.
    useAuthStore.setState({ status: 'unauthenticated', user: null, session: null });

    renderHome();

    expect(screen.getByTestId('guest-region-switcher')).toHaveTextContent(
      DEFAULT_GUEST_REGION.fullName,
    );
  });

  it('게스트에게는 보고 있는 동네 이름을 제목으로 쓴다', function titlesWithDongName() {
    // "우리 동네"는 그 동네가 자기 동네일 때만 맞는 말이다.
    useAuthStore.setState({ status: 'unauthenticated', user: null, session: null });

    renderHome();

    expect(screen.getByText(`${DEFAULT_GUEST_REGION.depth3} 중고거래`)).toBeInTheDocument();
    expect(screen.queryByText('우리 동네 중고거래')).toBeNull();
  });

  it('세션을 확인하는 중에는 목록을 부르지 않는다', function waitsWhileLoading() {
    // 초기값이 'loading'이다. 이때 그리면 로그인 사용자가 남의 동네를 한 번 보게 된다.
    renderHome();

    expect(mockNeighborhoodPostsQuery).toHaveBeenCalledTimes(0);
    expect(screen.getByText('세션을 확인하는 중입니다…')).toBeInTheDocument();
    expect(screen.getByText('동네를 확인하는 중입니다…')).toBeInTheDocument();
  });

  it('로그인 사용자에게는 게스트 안내를 그리지 않는다', function hidesGuestBannerForMember() {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'member-1' } as AuthUser,
      session: null,
    });

    renderHome();

    expect(screen.queryByRole('link', { name: '시작하기' })).toBeNull();
    expect(screen.queryByTestId('guest-region-switcher')).toBeNull();
  });
});
