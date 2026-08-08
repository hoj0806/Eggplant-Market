import {
  toMannerTempCauseText,
  toMannerTempEvidenceText,
  toTemperatureDeltaText,
} from './mannerTempEvent';
import type { MannerTempEvent } from '../types';

function buildEvent(overrides: Partial<MannerTempEvent> = {}): MannerTempEvent {
  return {
    id: 1,
    beforeTemp: 36.5,
    afterTemp: 37.0,
    reviewCount: 1,
    reviewSum: 0.5,
    createdAt: '2026-08-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('toTemperatureDeltaText', function deltaSuite() {
  it('오른 값에는 +를, 내린 값에는 −를 붙인다', function signCase() {
    expect(toTemperatureDeltaText(buildEvent())).toBe('+0.5');
    expect(toTemperatureDeltaText(buildEvent({ beforeTemp: 37.0, afterTemp: 36.5 }))).toBe('−0.5');
  });

  // 0.1을 더하는 후기가 있어(0013의 normal) 뺄셈이 0.09999…를 낸다. 소수 한 자리로 덮는다.
  it('부동소수 뺄셈이 새어 나오지 않는다', function floatCase() {
    expect(toTemperatureDeltaText(buildEvent({ beforeTemp: 36.5, afterTemp: 36.6 }))).toBe('+0.1');
    expect(toTemperatureDeltaText(buildEvent({ beforeTemp: 37.2, afterTemp: 37.3 }))).toBe('+0.1');
  });
});

describe('toMannerTempCauseText', function causeSuite() {
  it('후기가 늘었으면 받았다고 읽는다', function addedCase() {
    const previous = buildEvent({ id: 1, reviewCount: 1 });
    const event = buildEvent({ id: 2, reviewCount: 2 });

    expect(toMannerTempCauseText(event, previous)).toBe('후기 1건을 받았어요');
  });

  // 이 표가 생긴 이유다. 글이 지워지거나 쓴 이웃이 떠나면 후기가 사라지고(0016) 온도가 움직인다.
  it('후기가 줄었으면 사라졌다고 읽는다', function removedCase() {
    const previous = buildEvent({ id: 1, reviewCount: 3 });
    const event = buildEvent({ id: 2, reviewCount: 2 });

    expect(toMannerTempCauseText(event, previous)).toBe('후기 1건이 사라졌어요');
  });

  it('한 문장에 여럿이 들어오면 그 수만큼 적는다', function batchCase() {
    const previous = buildEvent({ id: 1, reviewCount: 0 });
    const event = buildEvent({ id: 2, reviewCount: 3 });

    expect(toMannerTempCauseText(event, previous)).toBe('후기 3건을 받았어요');
  });

  // 견줄 앞 줄이 없으면 모른다. "알 수 없음"을 지어내면 어긋남이 정상처럼 보인다(0018).
  it('이력의 첫 줄에는 이유를 붙이지 않는다', function firstRowCase() {
    expect(toMannerTempCauseText(buildEvent(), undefined)).toBeNull();
  });

  // 후기는 그대로인데 온도만 움직인 줄 — 정상 경로에서는 안 생긴다. 여기서도 지어내지 않는다.
  it('후기 개수가 그대로면 이유를 붙이지 않는다', function noChangeCase() {
    const previous = buildEvent({ id: 1, reviewCount: 2, afterTemp: 37.1 });
    const event = buildEvent({ id: 2, reviewCount: 2, beforeTemp: 37.1, afterTemp: 99 });

    expect(toMannerTempCauseText(event, previous)).toBeNull();
  });
});

describe('toMannerTempEvidenceText', function evidenceSuite() {
  it('개수와 합계를 함께 적는다', function bothCase() {
    expect(toMannerTempEvidenceText(buildEvent({ reviewCount: 2, reviewSum: 0.6 }))).toBe(
      '후기 2건 · 합계 +0.6',
    );
  });

  // 나쁜 후기 하나가 좋은 후기 둘을 지운다 — 개수와 방향이 따로 노는 것이 이 줄의 요점이다.
  it('합계가 음수면 개수가 여럿이어도 −로 적는다', function negativeCase() {
    expect(toMannerTempEvidenceText(buildEvent({ reviewCount: 3, reviewSum: -0.4 }))).toBe(
      '후기 3건 · 합계 −0.4',
    );
  });

  it('합계가 0이면 +0.0이다', function zeroCase() {
    expect(toMannerTempEvidenceText(buildEvent({ reviewCount: 2, reviewSum: 0 }))).toBe(
      '후기 2건 · 합계 +0.0',
    );
  });
});
