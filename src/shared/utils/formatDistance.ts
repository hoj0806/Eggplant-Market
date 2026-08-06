/**
 * 미터를 사람이 읽는 거리로.
 *
 * 처음에는 검색 반경 쪽(`toSearchRadiusLabel`)에만 있었다. 거기서 다루는 값은 500·1000·2000처럼
 * 고른 값뿐이라 나누면 늘 딱 떨어졌는데, 지도가 **잰 거리**를 적기 시작하면서 4971m 같은 값이
 * 들어왔고 `4.971 → toFixed(1)`이 **"5.0km"**를 냈다. 값은 맞지만 아무도 그렇게 쓰지 않는다.
 *
 * 그래서 소수점을 **먼저 정리하고** 0으로 끝나면 떼는 순서로 바꿔 공용 자리에 두었다.
 * 고른 값과 잰 값이 같은 규칙으로 보여야 "2km 이내"와 "5km"가 한 화면에서 어긋나지 않는다.
 */

const METERS_PER_KILOMETER = 1000;

export function formatDistance(meters: number): string {
  const safe = Math.max(meters, 0);

  if (safe < METERS_PER_KILOMETER) {
    return `${Math.round(safe)}m`;
  }

  // 소수점 한 자리에서 끊고, "5.0"이면 "5"로 줄인다. Number()가 뒤의 0을 떼어 준다.
  const km = Number((safe / METERS_PER_KILOMETER).toFixed(1));

  return `${km}km`;
}
