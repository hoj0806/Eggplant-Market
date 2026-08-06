import { useEffect, useState } from 'react';

/**
 * 스스로 흐르는 "지금".
 *
 * 상대 시각을 적는 화면(`formatTimeAgo`의 "3분 전", `toBumpRemainingText`의 "2시간 뒤")은
 * 지금까지 렌더 순간의 `new Date()`를 기준으로 삼았다. 목록을 열어 두고 있으면 그 값이
 * 그대로 멈춰 있어서, **10분을 보고 있어도 계속 "3분 전"이라고 적힌다.**
 * 끌올 버튼은 더 나쁘다 — 남은 시간이 0이 됐는데도 잠긴 채로 남는다.
 *
 * 1분마다 흐른다. 두 문구 모두 분 단위까지만 적기 때문이다(`toBumpRemainingText`가
 * "초까지 적으면 화면을 다시 그리지 않는 한 곧바로 거짓말이 된다"고 적어 둔 그대로다).
 * 더 자주 흐르게 하면 바뀌는 것 없이 목록만 다시 그린다.
 *
 * 첫 값을 인자로 받지 않는다. 화면마다 다른 "지금"을 쓰면 같은 글이 목록과 상세에서 다른
 * 시각으로 보인다.
 */
export const NOW_TICK_INTERVAL_MS = 60 * 1000;

export function useNow(): Date {
  const [now, setNow] = useState(function initialNow(): Date {
    return new Date();
  });

  useEffect(function startTicking(): () => void {
    const timer = setInterval(function tick(): void {
      setNow(new Date());
    }, NOW_TICK_INTERVAL_MS);

    return function stopTicking(): void {
      clearInterval(timer);
    };
  }, []);

  return now;
}
