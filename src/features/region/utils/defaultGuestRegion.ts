import type { Region } from '../types';

/**
 * 처음 온 사람에게 먼저 보여줄 동네.
 *
 * 왜 필요한가 — 게스트의 동네는 localStorage에 남는데(`storedRegion.ts`) 처음 온 사람에겐
 * 그 자리가 비어 있다. 동네가 없으면 목록을 그릴 기준이 없어 **첫 화면이 빈 채로 끝난다.**
 * 링크를 처음 누른 사람이 이탈하던 자리가 정확히 여기다.
 *
 * 왜 석관동인가 — `scripts/seedStory.mjs`가 심은 글이 성북·동대문·중랑 네 동네에 모여 있고
 * 그중 석관동이 가장 많다(24개 중 7개). 좌표는 그 동네를 쓰는 계정의 `profiles` 값 그대로,
 * 즉 **동네의 대표 좌표**이지 누군가의 현재 위치가 아니다(`types.ts`의 `Region.coords` 참고).
 *
 * **저장하지 않는다.** 이 값을 localStorage에 써 버리면 "아직 안 고른 사람"과
 * "석관동을 직접 고른 사람"이 같아져, 다음에 무엇을 물어야 할지 알 수 없게 된다.
 * `useActiveRegion`이 읽을 때만 대신 세우고 사용자가 고르는 순간 진짜 값이 덮는다.
 *
 * **시드와 묶여 있다.** `npm run seed:story -- --clean`으로 심은 것을 전부 치우면
 * 이 동네도 비어 첫 화면이 다시 빈다. 치울 일이 생기면 이 상수도 함께 봐야 한다.
 */
export const DEFAULT_GUEST_REGION: Region = {
  code: '1129013900',
  depth1: '서울특별시',
  depth2: '성북구',
  depth3: '석관동',
  fullName: '서울특별시 성북구 석관동',
  coords: { lat: 37.6129860183777, lng: 127.0614007785 },
};
