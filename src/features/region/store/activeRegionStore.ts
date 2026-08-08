import { create } from 'zustand';
import { readStoredRegion, writeStoredRegion } from '../utils/storedRegion';
import type { Region } from '../types';

/**
 * 게스트가 고른 동네.
 *
 * 로그인 사용자에게는 쓰이지 않는다 — 그쪽 동네는 profiles가 원본이다.
 * 스토어를 따로 두는 이유는 화면 여러 곳(검색 페이지, 결과 목록, 안내 문구)이
 * 같은 값을 보고 즉시 함께 갱신돼야 하기 때문이다. localStorage만 쓰면 리렌더가 걸리지 않는다.
 */
type ActiveRegionStoreState = {
  guestRegion: Region | null;
  setGuestRegion(region: Region): void;
};

export const useActiveRegionStore = create<ActiveRegionStoreState>(function initStore(set) {
  return {
    // 새로고침해도 고른 동네가 남아 있어야 한다.
    guestRegion: readStoredRegion(),
    setGuestRegion(region) {
      writeStoredRegion(region);
      set({ guestRegion: region });
    },
  };
});

export function selectGuestRegion(state: ActiveRegionStoreState): Region | null {
  return state.guestRegion;
}

export function selectSetGuestRegion(
  state: ActiveRegionStoreState,
): ActiveRegionStoreState['setGuestRegion'] {
  return state.setGuestRegion;
}
