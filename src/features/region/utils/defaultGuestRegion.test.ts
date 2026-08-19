import { DEFAULT_GUEST_REGION } from './defaultGuestRegion';
import { isRegion } from './storedRegion';

/**
 * 상수 하나를 두고 굳이 테스트를 두는 이유.
 *
 * 이 값은 **손으로 적은 Region**이다. 다른 동네 값은 전부 카카오 역지오코딩이 만들어 주는데
 * 이것만 사람이 친다. 칸 하나를 빠뜨리거나 좌표를 뒤집어도 타입은 통과하고(둘 다 number),
 * 어긋난 값은 첫 화면이 빈 목록으로 뜬 뒤에야 드러난다.
 */
describe('DEFAULT_GUEST_REGION', function defaultGuestRegionSuite() {
  it('저장된 동네와 같은 형태다', function matchesRegionShape() {
    // localStorage에서 읽은 값을 거르는 바로 그 검사를 통과해야 한다.
    // 통과하지 못하면 게스트가 이 동네를 "고른" 순간 다음 방문에서 버려진다.
    expect(isRegion(DEFAULT_GUEST_REGION)).toBe(true);
  });

  it('법정동 코드가 10자리 숫자다', function hasLegalDongCode() {
    expect(DEFAULT_GUEST_REGION.code).toMatch(/^\d{10}$/);
  });

  it('전체 이름이 세 단계를 그대로 이어 붙인 것이다', function fullNameMatchesDepths() {
    // 화면은 fullName을, 제목은 depth3을 쓴다. 둘이 어긋나면 같은 화면에서 다른 동네를 가리킨다.
    const joined = [
      DEFAULT_GUEST_REGION.depth1,
      DEFAULT_GUEST_REGION.depth2,
      DEFAULT_GUEST_REGION.depth3,
    ].join(' ');

    expect(DEFAULT_GUEST_REGION.fullName).toBe(joined);
  });

  it('좌표가 대한민국 안이다', function coordsAreInKorea() {
    // lat/lng을 뒤집어 적는 실수를 잡는다 — 위경도를 바꾸면 이 범위를 벗어난다.
    expect(DEFAULT_GUEST_REGION.coords.lat).toBeGreaterThan(33);
    expect(DEFAULT_GUEST_REGION.coords.lat).toBeLessThan(39);
    expect(DEFAULT_GUEST_REGION.coords.lng).toBeGreaterThan(124);
    expect(DEFAULT_GUEST_REGION.coords.lng).toBeLessThan(132);
  });
});
