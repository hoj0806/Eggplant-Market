import {
  DEFAULT_SEARCH_RADIUS_M,
  SEARCH_RADIUS_OPTIONS,
  toSearchRadius,
  toSearchRadiusLabel,
} from './searchRadius';

describe('toSearchRadiusLabel', function toSearchRadiusLabelSuite() {
  it('1km 미만은 미터로 적는다', function metersUnderOneKm() {
    expect(toSearchRadiusLabel(500)).toBe('500m');
    expect(toSearchRadiusLabel(999)).toBe('999m');
  });

  it('1km 이상은 킬로미터로 적는다', function kilometers() {
    expect(toSearchRadiusLabel(1000)).toBe('1km');
    expect(toSearchRadiusLabel(2000)).toBe('2km');
    expect(toSearchRadiusLabel(10000)).toBe('10km');
  });

  it('딱 떨어지지 않으면 소수점 한 자리까지만 적는다', function fractionalKilometers() {
    expect(toSearchRadiusLabel(1500)).toBe('1.5km');
    expect(toSearchRadiusLabel(1234)).toBe('1.2km');
  });
});

describe('toSearchRadius', function toSearchRadiusSuite() {
  it('뜻이 서지 않는 값은 기본값으로 되돌린다', function fallsBackToDefault() {
    expect(toSearchRadius(null)).toBe(DEFAULT_SEARCH_RADIUS_M);
    expect(toSearchRadius(undefined)).toBe(DEFAULT_SEARCH_RADIUS_M);
    expect(toSearchRadius(0)).toBe(DEFAULT_SEARCH_RADIUS_M);
    expect(toSearchRadius(-500)).toBe(DEFAULT_SEARCH_RADIUS_M);
  });

  it('목록에 없는 값이어도 그대로 쓴다', function keepsUnlistedValues() {
    // 기본값으로 되돌리면 사용자가 정한 적 없는 반경으로 조용히 바뀐다.
    // 범위를 조이는 것은 서버의 일이다(0024, 100~20000).
    expect(toSearchRadius(1234)).toBe(1234);
    expect(toSearchRadius(99999)).toBe(99999);
  });
});

describe('SEARCH_RADIUS_OPTIONS', function searchRadiusOptionsSuite() {
  it('기본값이 고를 수 있는 값 안에 있다', function defaultIsSelectable() {
    expect(SEARCH_RADIUS_OPTIONS).toContain(DEFAULT_SEARCH_RADIUS_M);
  });

  it('서버가 조이는 범위(100~20000) 안에 있다', function withinServerBounds() {
    for (const radiusM of SEARCH_RADIUS_OPTIONS) {
      expect(radiusM).toBeGreaterThanOrEqual(100);
      expect(radiusM).toBeLessThanOrEqual(20000);
    }
  });

  it('작은 값부터 차례로 놓여 있다', function ascending() {
    const sorted = [...SEARCH_RADIUS_OPTIONS].sort(function byValue(a: number, b: number): number {
      return a - b;
    });

    expect(SEARCH_RADIUS_OPTIONS).toEqual(sorted);
  });
});
