import { DEFAULT_SEARCH_RADIUS_M } from '../utils/searchRadius';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useMyProfileQuery } from '../../profile/hooks/useProfileQuery';
import {
  selectGuestRegion,
  selectSetGuestRegion,
  useActiveRegionStore,
} from '../../region/store/activeRegionStore';
import { DEFAULT_GUEST_REGION } from '../../region/utils/defaultGuestRegion';
import type { Region } from '../../region/types';

export type ActiveRegion = {
  /** 지금 보고 있는 동네. 아직 정해지지 않았으면 null. */
  region: Region | null;
  /**
   * 반경 기준으로 볼 때 쓰는 반경(미터).
   *
   * 게스트에게는 언제나 기본값이다 — 저장할 곳이 없다. 동네처럼 브라우저에 남기지 않은 것은
   * 반경이 **동네가 정해진 뒤에야 뜻이 서는 값**이라서다. 동네 없이 반경만 남아 있으면
   * 다음에 왔을 때 무엇을 기준으로 잰 값인지 알 수 없다.
   */
  searchRadiusM: number;
  /** 세션·프로필을 확인하는 중. 이때 "동네를 정하세요"를 띄우면 깜빡인다. */
  isLoading: boolean;
  /** 비로그인 사용자인가. 동네를 고르라고 안내하는 문구가 달라진다. */
  isGuest: boolean;
  /**
   * 지금 동네가 **사용자가 고른 것이 아니라 대신 세운 것**인가.
   *
   * 게스트이면서 아직 한 번도 고르지 않았을 때만 참이다. `region`이 null인지로는 이걸 알 수
   * 없다 — 기본값을 세우는 순간 언제나 채워져 있기 때문이다. 화면은 이 값으로
   * "여기가 당신 동네라고 정한 적은 없다"를 알리고 바꿀 길을 함께 낸다.
   */
  isDefaultRegion: boolean;
  /** 게스트가 동네를 고를 때 호출한다. 로그인 사용자에게는 의미가 없다. */
  setGuestRegion(region: Region): void;
};

/**
 * "지금 보고 있는 동네"를 한 곳에서 정한다.
 *
 * 검색과 필터는 언제나 내 동네 안에서만 도는데, 그 동네의 출처가 셋이다.
 *   - 로그인 사용자: profiles에 저장된 동네가 원본이다.
 *   - 비로그인 사용자: 저장할 곳이 없어 직접 고른 동네를 브라우저에 남긴다.
 *   - **아직 아무것도 고르지 않은 사람**: 기본 동네를 대신 세운다.
 *
 * 셋째가 있는 이유는 첫 화면이다. 처음 온 사람에게 동네를 먼저 고르라고 하면 물건을 한 개도
 * 못 본 채 일을 시키는 셈이라, 링크를 눌러 본 사람이 그 자리에서 되돌아간다.
 *
 * 화면마다 이 분기를 반복하면 한쪽만 고치는 실수가 나므로 훅으로 묶는다.
 */
export function useActiveRegion(): ActiveRegion {
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const guestRegion = useActiveRegionStore(selectGuestRegion);
  const setGuestRegion = useActiveRegionStore(selectSetGuestRegion);

  const isMember = status === 'authenticated';
  const profileQuery = useMyProfileQuery(isMember ? (user?.id ?? null) : null);

  if (status === 'loading') {
    return {
      region: null,
      searchRadiusM: DEFAULT_SEARCH_RADIUS_M,
      isLoading: true,
      isGuest: false,
      isDefaultRegion: false,
      setGuestRegion,
    };
  }

  if (isMember) {
    return {
      region: profileQuery.data?.region ?? null,
      searchRadiusM: profileQuery.data?.searchRadiusM ?? DEFAULT_SEARCH_RADIUS_M,
      isLoading: profileQuery.isLoading,
      isGuest: false,
      // 로그인 사용자에게는 기본값을 세우지 않는다. 동네가 비어 있으면 온보딩이 맡는 일이라
      // (RequireOnboarding) 여기서 대신 채우면 그 화면이 영영 안 뜬다.
      isDefaultRegion: false,
      setGuestRegion,
    };
  }

  return {
    region: guestRegion ?? DEFAULT_GUEST_REGION,
    searchRadiusM: DEFAULT_SEARCH_RADIUS_M,
    isLoading: false,
    isGuest: true,
    isDefaultRegion: guestRegion === null,
    setGuestRegion,
  };
}
