import { act, renderHook } from '@testing-library/react';
import { NOW_TICK_INTERVAL_MS, useNow } from './useNow';

describe('useNow', function useNowSuite() {
  beforeEach(function freezeClock() {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-06T10:00:00.000Z'));
  });

  afterEach(function restoreClock() {
    jest.useRealTimers();
  });

  it('처음에는 지금 시각을 준다', function startsAtNow() {
    const { result } = renderHook(useNow);

    expect(result.current.toISOString()).toBe('2026-08-06T10:00:00.000Z');
  });

  it('1분이 지나면 그만큼 흐른다', function ticksEveryMinute() {
    const { result } = renderHook(useNow);

    act(function advance(): void {
      jest.advanceTimersByTime(NOW_TICK_INTERVAL_MS);
    });

    expect(result.current.toISOString()).toBe('2026-08-06T10:01:00.000Z');
  });

  it('1분이 안 됐으면 그대로다', function staysWithinTick() {
    // 더 자주 흐르게 하면 바뀌는 것 없이 목록만 다시 그린다 —
    // 두 문구 모두 분 단위까지만 적기 때문이다.
    const { result } = renderHook(useNow);

    act(function advance(): void {
      jest.advanceTimersByTime(NOW_TICK_INTERVAL_MS - 1);
    });

    expect(result.current.toISOString()).toBe('2026-08-06T10:00:00.000Z');
  });

  it('여러 번 지나도 계속 흐른다', function keepsTicking() {
    const { result } = renderHook(useNow);

    act(function advance(): void {
      jest.advanceTimersByTime(NOW_TICK_INTERVAL_MS * 3);
    });

    expect(result.current.toISOString()).toBe('2026-08-06T10:03:00.000Z');
  });

  it('화면을 떠나면 더 이상 흐르지 않는다', function stopsAfterUnmount() {
    // 걷어 내지 않으면 목록을 닫은 뒤에도 타이머가 남아 setState를 계속 부른다.
    const { unmount } = renderHook(useNow);

    unmount();

    expect(jest.getTimerCount()).toBe(0);
  });
});
