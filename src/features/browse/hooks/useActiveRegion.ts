import { DEFAULT_SEARCH_RADIUS_M } from '../utils/searchRadius';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useMyProfileQuery } from '../../profile/hooks/useProfileQuery';
import {
  selectGuestRegion,
  selectSetGuestRegion,
  useActiveRegionStore,
} from '../../region/store/activeRegionStore';
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
  /** 게스트가 동네를 고를 때 호출한다. 로그인 사용자에게는 의미가 없다. */
  setGuestRegion(region: Region): void;
};

/**
 * "지금 보고 있는 동네"를 한 곳에서 정한다.
 *
 * 검색과 필터는 언제나 내 동네 안에서만 도는데, 그 동네의 출처가 둘이다.
 *   - 로그인 사용자: profiles에 저장된 동네가 원본이다.
 *   - 비로그인 사용자: 저장할 곳이 없어 직접 고른 동네를 브라우저에 남긴다.
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
      setGuestRegion,
    };
  }

  if (isMember) {
    return {
      region: profileQuery.data?.region ?? null,
      searchRadiusM: profileQuery.data?.searchRadiusM ?? DEFAULT_SEARCH_RADIUS_M,
      isLoading: profileQuery.isLoading,
      isGuest: false,
      setGuestRegion,
    };
  }

  return {
    region: guestRegion,
    searchRadiusM: DEFAULT_SEARCH_RADIUS_M,
    isLoading: false,
    isGuest: true,
    setGuestRegion,
  };
}
