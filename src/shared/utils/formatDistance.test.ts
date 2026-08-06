import { formatDistance } from './formatDistance';

describe('formatDistance', function formatDistanceSuite() {
  it('1km 미만은 미터로 적는다', function metersUnderOneKm() {
    expect(formatDistance(0)).toBe('0m');
    expect(formatDistance(740)).toBe('740m');
    expect(formatDistance(999)).toBe('999m');
  });

  it('미터는 소수점을 남기지 않는다', function roundsMeters() {
    // 잰 거리는 1000.45506895 같은 값으로 온다. 소수점 여덟 자리를 적을 이유가 없다.
    expect(formatDistance(740.4)).toBe('740m');
    expect(formatDistance(740.6)).toBe('741m');
  });

  it('1km 이상은 킬로미터로 적는다', function kilometers() {
    expect(formatDistance(1000)).toBe('1km');
    expect(formatDistance(2000)).toBe('2km');
    expect(formatDistance(1234)).toBe('1.2km');
  });

  it('"5.0km"처럼 쓸모없는 0을 남기지 않는다', function dropsTrailingZero() {
    // 이 규칙 때문에 이 함수가 shared로 올라왔다 — 반경 라벨은 고른 값만 다뤄서
    // 늘 딱 떨어졌지만, 지도가 잰 거리를 적기 시작하자 4971m이 "5.0km"로 나왔다.
    expect(formatDistance(4971)).toBe('5km');
    expect(formatDistance(1999)).toBe('2km');
  });

  it('음수는 0으로 본다', function clampsNegative() {
    // 거리가 음수일 수는 없지만, 나오면 "-1m"를 적는 것보다 0이 덜 이상하다.
    expect(formatDistance(-5)).toBe('0m');
  });
});
