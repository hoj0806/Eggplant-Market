import type { MannerTempEvent } from '../types';

/**
 * 온도가 얼마나 움직였는지. 부호를 붙여 적는다.
 *
 * 0.1을 더하는 후기가 있어(0013의 normal) 부동소수 뺄셈이 `0.09999999999999432`를 낼 수 있다.
 * `toFixed(1)`이 그 자리를 덮는다 — 온도는 어차피 `numeric(4, 1)`이라 소수 한 자리가 전부다.
 *
 * `+0.0`은 나오지 않는다. 값이 안 바뀐 update는 애초에 이력에 안 남기 때문이다(0034의 `when`).
 */
export function toTemperatureDeltaText(event: MannerTempEvent): string {
  const delta = event.afterTemp - event.beforeTemp;
  const sign = delta > 0 ? '+' : '−';

  return `${sign}${Math.abs(delta).toFixed(1)}`;
}

/**
 * 이 줄이 왜 생겼는가. **지어내지 않고 앞 줄과 견주어 읽어 낸다.**
 *
 * `previous`는 목록에서 **바로 다음에 오는(더 오래된) 줄**이다. 최신순으로 받아 오므로
 * 배열에서는 뒤에 있다 — 부르는 쪽이 `events[index + 1]`을 넘긴다.
 *
 * 세 가지를 각각 null로 흘려보낸다.
 *
 *   ① 견줄 앞 줄이 없다   — 이력의 첫 줄이다. 그 전에 후기가 몇 건이었는지는 아무 데도 없다
 *                          (0034가 백필하지 않은 이유와 같은 자리다)
 *   ② 개수가 그대로다     — 후기는 그대로인데 온도만 움직였다는 뜻이라 **정상 경로에서는
 *                          생기지 않는다.** 지어낸 문장을 붙이는 대신 숫자만 보여 준다
 *   ③ 둘 다 아니다        — 아래 두 갈래가 받는다
 *
 * ①②에서 "알 수 없음" 같은 말을 붙이지 않는 이유는 0018이 겪은 자리 때문이다 —
 * **모르는 것을 아는 척하는 문장이 붙으면 어긋남이 정상 동작처럼 보인다.**
 */
export function toMannerTempCauseText(
  event: MannerTempEvent,
  previous: MannerTempEvent | undefined,
): string | null {
  if (previous === undefined) {
    return null;
  }

  const delta = event.reviewCount - previous.reviewCount;

  if (delta > 0) {
    return `후기 ${delta}건을 받았어요`;
  }

  if (delta < 0) {
    return `후기 ${Math.abs(delta)}건이 사라졌어요`;
  }

  return null;
}

/**
 * 그 순간의 근거를 한 줄로. 이유를 못 읽어 낸 줄에서도 이것만은 언제나 적힌다.
 *
 * 합계에 부호를 붙이는 것은 "받은 후기가 셋인데 합계가 −0.4"처럼 **개수와 방향이 따로
 * 논다는 사실**이 이 화면의 요점이기 때문이다. 나쁜 후기 하나가 좋은 후기 둘을 지운다.
 */
export function toMannerTempEvidenceText(event: MannerTempEvent): string {
  const sign = event.reviewSum >= 0 ? '+' : '−';

  return `후기 ${event.reviewCount}건 · 합계 ${sign}${Math.abs(event.reviewSum).toFixed(1)}`;
}
