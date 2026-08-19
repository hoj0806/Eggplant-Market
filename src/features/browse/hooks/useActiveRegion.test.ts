import { renderHook } from '@testing-library/react';
import { useActiveRegion } from './useActiveRegion';
import { AUTH_INITIAL_STATE, useAuthStore } from '../../auth/store/authStore';
import { useActiveRegionStore } from '../../region/store/activeRegionStore';
import { DEFAULT_GUEST_REGION } from '../../region/utils/defaultGuestRegion';
import { DEFAULT_SEARCH_RADIUS_M } from '../utils/searchRadius';
import type { AuthUser } from '../../auth/types';
import type { Region } from '../../region/types';

// useProfileQuery는 profileApi → supabaseClient → import.meta.env에 닿는다.
// 실제 모듈은 로드하지 않는다(troble.md 「탐색」 1번 — 이 저장소의 표준 처방).
const mockProfileQuery = jest.fn();

jest.mock('../../profile/hooks/useProfileQuery', function mockUseProfileQuery() {
  return {
    useMyProfileQuery: function useMyProfileQuery(userId: string | null) {
      return mockProfileQuery(userId);
    },
  };
});

const PICKED_REGION: Region = {
  code: '1129013800',
  depth1: '서울특별시',
  depth2: '성북구',
  depth3: '장위동',
  fullName: '서울특별시 성북구 장위동',
  coords: { lat: 37.617, lng: 127.0495 },
};

const MEMBER_REGION: Region = {
  code: '1123011000',
  depth1: '서울특별시',
  depth2: '동대문구',
  depth3: '이문동',
  fullName: '서울특별시 동대문구 이문동',
  coords: { lat: 37.6004, lng: 127.0663 },
};

/**
 * 로그인 상태로 만든다.
 *
 * `AuthUser`는 supabase-js의 `User`라 칸이 많은데 이 훅이 보는 것은 `id` 하나뿐이다.
 * 나머지를 채워 넣으면 무엇이 검사에 쓰이는지가 가려지므로, 안 보는 칸은 두지 않는다.
 */
function signIn(): void {
  useAuthStore.setState({
    status: 'authenticated',
    user: { id: 'member-1' } as AuthUser,
    session: null,
  });
}

beforeEach(function resetStores(): void {
  mockProfileQuery.mockReturnValue({ data: undefined, isLoading: false });
  useAuthStore.setState(AUTH_INITIAL_STATE);
  useActiveRegionStore.setState({ guestRegion: null });
  localStorage.clear();
});

describe('useActiveRegion', function activeRegionSuite() {
  it('세션을 확인하는 중에는 동네를 말하지 않는다', function waitsWhileLoading() {
    // status 초기값이 'loading'이다. 이때 기본 동네를 세우면 로그인 사용자의 화면에
    // 남의 동네가 한 번 번쩍인 뒤 자기 동네로 바뀐다.
    const { result } = renderHook(useActiveRegion);

    expect(result.current.region).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isGuest).toBe(false);
    expect(result.current.isDefaultRegion).toBe(false);
  });

  it('아직 아무것도 고르지 않은 게스트에게는 기본 동네를 세운다', function fallsBackForNewGuest() {
    useAuthStore.setState({ status: 'unauthenticated', user: null, session: null });

    const { result } = renderHook(useActiveRegion);

    expect(result.current.region).toEqual(DEFAULT_GUEST_REGION);
    expect(result.current.isGuest).toBe(true);
    // 이 참값이 화면에 "고른 적 없다"를 알리고 바꿀 길을 내게 한다.
    expect(result.current.isDefaultRegion).toBe(true);
    expect(result.current.searchRadiusM).toBe(DEFAULT_SEARCH_RADIUS_M);
  });

  it('게스트가 고른 동네가 기본값을 덮는다', function prefersPickedRegion() {
    useAuthStore.setState({ status: 'unauthenticated', user: null, session: null });
    useActiveRegionStore.setState({ guestRegion: PICKED_REGION });

    const { result } = renderHook(useActiveRegion);

    expect(result.current.region).toEqual(PICKED_REGION);
    expect(result.current.isDefaultRegion).toBe(false);
  });

  it('로그인 사용자에게는 프로필의 동네를 준다', function usesProfileRegion() {
    signIn();
    mockProfileQuery.mockReturnValue({
      data: { region: MEMBER_REGION, searchRadiusM: 3000 },
      isLoading: false,
    });

    const { result } = renderHook(useActiveRegion);

    expect(result.current.region).toEqual(MEMBER_REGION);
    expect(result.current.searchRadiusM).toBe(3000);
    expect(result.current.isGuest).toBe(false);
    expect(result.current.isDefaultRegion).toBe(false);
  });

  it('동네가 없는 로그인 사용자에게는 기본 동네를 세우지 않는다', function neverFallsBackForMember() {
    signIn();
    mockProfileQuery.mockReturnValue({
      data: { region: null, searchRadiusM: null },
      isLoading: false,
    });

    const { result } = renderHook(useActiveRegion);

    // 여기서 대신 채우면 온보딩(RequireOnboarding)이 영영 안 뜬다.
    expect(result.current.region).toBeNull();
    expect(result.current.isDefaultRegion).toBe(false);
  });

  it('게스트의 동네가 남아 있어도 로그인하면 프로필이 이긴다', function memberWinsOverStoredGuest() {
    // 게스트로 둘러보다 로그인한 사람의 브라우저에는 고른 동네가 그대로 남아 있다.
    useActiveRegionStore.setState({ guestRegion: PICKED_REGION });
    signIn();
    mockProfileQuery.mockReturnValue({
      data: { region: MEMBER_REGION, searchRadiusM: 2000 },
      isLoading: false,
    });

    const { result } = renderHook(useActiveRegion);

    expect(result.current.region).toEqual(MEMBER_REGION);
  });
});
