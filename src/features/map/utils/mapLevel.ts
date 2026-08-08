/**
 * 검색 반경 → 카카오맵 확대 단계(level).
 *
 * `map.setBounds()`를 쓰지 않은 이유는 **결과가 화면 크기에 따라 달라지기 때문**이다.
 * 같은 반경인데 기기마다 다른 배율로 열리면 "2km는 이 정도"라는 감이 서지 않고,
 * 테스트로 고정하기도 어렵다. 반경은 사용자가 고른 값이라 배율도 그 값에서 곧장 나오는 편이
 * 예측 가능하다.
 *
 * level은 **낮을수록 확대**다(1이 가장 가깝다). 아래 임계값은 카카오맵의 축척과 맞춘 것으로,
 * 지름(반경 × 2)이 화면에 들어오는 가장 가까운 단계를 고른다.
 */

type MapLevelThreshold = {
  /** 이 반경(미터) 이하면 아래 level을 쓴다. */
  maxRadiusM: number;
  level: number;
};

/** 작은 반경부터. 처음으로 걸리는 것이 답이다. */
const MAP_LEVEL_THRESHOLDS: ReadonlyArray<MapLevelThreshold> = [
  { maxRadiusM: 500, level: 6 },
  { maxRadiusM: 1000, level: 7 },
  { maxRadiusM: 2000, level: 8 },
  { maxRadiusM: 5000, level: 9 },
  { maxRadiusM: 10000, level: 10 },
];

/** 표의 어느 칸에도 안 걸릴 만큼 넓은 반경. 서버 상한(20000)이 여기 온다. */
const WIDEST_MAP_LEVEL = 11;

export function toMapLevel(radiusM: number): number {
  const found = MAP_LEVEL_THRESHOLDS.find(function fits(threshold: MapLevelThreshold): boolean {
    return radiusM <= threshold.maxRadiusM;
  });

  return found?.level ?? WIDEST_MAP_LEVEL;
}
