/**
 * 매너온도를 화면에 놓는 규칙.
 *
 * 여태 `toTemperatureText`가 마이페이지 카드와 판매자 카드에 따로 적혀 있었다.
 * 프로필 화면까지 셋이 되면 한 곳만 고쳐졌을 때 같은 온도가 화면마다 다르게 보인다.
 */

/** 0001의 recalc_manner_temp가 0~99로 자른다. 눈금의 끝도 같아야 한다. */
export const MAX_MANNER_TEMP = 99;

/** 소수 한 자리까지 보여준다. 기본값 36.5°가 그대로 읽혀야 한다. */
export function toTemperatureText(mannerTemp: number): string {
  return `${mannerTemp.toFixed(1)}°C`;
}

/** 눈금을 얼마나 채울지(0~1). 서버가 이미 잘라 주지만 화면도 제 눈금을 넘기지 않는다. */
export function toTemperatureRatio(mannerTemp: number): number {
  if (Number.isNaN(mannerTemp)) {
    return 0;
  }

  return Math.min(Math.max(mannerTemp, 0), MAX_MANNER_TEMP) / MAX_MANNER_TEMP;
}
