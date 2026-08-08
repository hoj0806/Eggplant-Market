import { useEffect, useState } from 'react';

/**
 * 값이 잠잠해질 때까지 기다렸다가 넘겨준다.
 * 검색어처럼 타이핑마다 바뀌는 값을 네트워크 호출에 바로 물리지 않기 위한 것.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(
    function scheduleUpdate() {
      const timerId = setTimeout(function applyValue(): void {
        setDebouncedValue(value);
      }, delayMs);

      return function cancelUpdate(): void {
        clearTimeout(timerId);
      };
    },
    [value, delayMs],
  );

  return debouncedValue;
}
