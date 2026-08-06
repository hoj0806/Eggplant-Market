/**
 * 검색 반경(`profiles.search_radius_m`)의 고를 수 있는 값과 표기.
 *
 * 자유 입력이 아니라 정해진 몇 개다. 반경이 실제로 고르는 것은 글이 아니라 **동네**이기
 * 때문이다 — `posts.location`이 동네 대표 좌표라(0005) 1000m과 1100m은 대개 같은 결과를 준다.
 * 슬라이더를 주면 사용자는 미세하게 움직이며 다른 결과를 기대하지만 화면은 꿈쩍도 않는다.
 *
 * 서버가 100~20000으로 한 번 더 조인다(0024). 여기 값은 그 안에 있다 —
 * 화면이 먼저 막는 이유는 거절당하는 요청을 아예 보내지 않기 위해서다.
 */

import { formatDistance } from '../../../shared/utils/formatDistance';

export const DEFAULT_SEARCH_RADIUS_M = 2000;

/** 화면에 그릴 순서 그대로. 기본값(2km)이 가운데 오도록 골랐다. */
export const SEARCH_RADIUS_OPTIONS: ReadonlyArray<number> = [500, 1000, 2000, 5000, 10000];

/**
 * "500m" · "2km".
 *
 * 규칙 자체는 `shared/utils/formatDistance`에 있다. 지도가 **잰 거리**를 같은 모양으로 적어야
 * "2km 이내"와 "5km"가 한 화면에서 어긋나지 않는다. 이 함수를 남겨 둔 것은 부르는 쪽이
 * 반경을 다룬다는 것을 이름으로 말해 주기 때문이다.
 */
export function toSearchRadiusLabel(radiusM: number): string {
  return formatDistance(radiusM);
}

/**
 * 서버·프로필에서 온 값을 화면이 쓸 수 있는 반경으로 옮긴다.
 *
 * 목록에 없는 값이어도 **그대로 쓴다.** 0024가 스키마에 제약을 두지 않았으므로 옛 값이나
 * 다른 경로로 들어온 값이 있을 수 있는데, 그것을 기본값으로 되돌리면 사용자가 정한 적 없는
 * 반경으로 조용히 바뀐다. 걸러 내는 것은 **뜻이 서지 않는 값**(null·0 이하)뿐이다.
 */
export function toSearchRadius(raw: number | null | undefined): number {
  if (raw === null || raw === undefined || raw <= 0) {
    return DEFAULT_SEARCH_RADIUS_M;
  }

  return raw;
}
