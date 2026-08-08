import { toMapLevel } from './mapLevel';
import { SEARCH_RADIUS_OPTIONS } from '../../browse/utils/searchRadius';

describe('toMapLevel', function toMapLevelSuite() {
  it('반경이 넓을수록 더 멀리서 본다', function widerIsFurther() {
    // 카카오맵의 level은 낮을수록 확대다. 반경과 반대 방향으로 움직이면 안 된다.
    expect(toMapLevel(500)).toBeLessThan(toMapLevel(2000));
    expect(toMapLevel(2000)).toBeLessThan(toMapLevel(10000));
  });

  it('고를 수 있는 반경마다 배율이 정해져 있다', function coversEveryOption() {
    const levels = SEARCH_RADIUS_OPTIONS.map(toMapLevel);

    // 반경 다섯 개가 서로 다른 배율로 열려야 "반경을 바꿨는데 지도가 그대로"가 아니다.
    expect(new Set(levels).size).toBe(SEARCH_RADIUS_OPTIONS.length);
  });

  it('경계값은 좁은 쪽에 붙는다', function boundaryGoesToCloser() {
    // 딱 500m면 500m 칸이다. 다음 칸으로 넘어가면 원이 화면보다 작게 그려진다.
    expect(toMapLevel(500)).toBe(toMapLevel(499));
    expect(toMapLevel(501)).toBe(toMapLevel(1000));
  });

  it('표에 없는 넓은 반경도 배율을 준다', function handlesWidest() {
    // 서버 상한이 20000이다(0024). 여기서 undefined가 나오면 지도가 아예 안 뜬다.
    expect(toMapLevel(20000)).toBeGreaterThan(toMapLevel(10000));
    expect(Number.isInteger(toMapLevel(20000))).toBe(true);
  });
});
