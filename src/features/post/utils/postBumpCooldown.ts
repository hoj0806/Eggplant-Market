import type { PostStatus } from '../types';

/** 0010 bump_post의 `interval '24 hours'`와 같은 값이어야 한다. */
export const BUMP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * 다음 끌올까지 남은 시간(ms). 지금 할 수 있으면 0이다.
 *
 * 판정의 진짜 주인은 서버다(0010). 여기 있는 것은 버튼을 잠그고 남은 시간을 적기 위한
 * 같은 규칙의 사본일 뿐이라, 시계가 조금 어긋나면 서버가 거절하고 그 문구가 화면에 뜬다.
 */
export function toBumpRemainingMs(bumpedAt: string, now: Date): number {
  const nextAvailable = new Date(bumpedAt).getTime() + BUMP_COOLDOWN_MS;
  const remaining = nextAvailable - now.getTime();

  return remaining > 0 ? remaining : 0;
}

/**
 * 지금 끌어올릴 수 있는가.
 *
 * 판매중이 아닌 글은 애초에 대상이 아니다 — 예약중·거래완료된 글이 홈 맨 위로 올라오면
 * 목록을 훑는 사람에게 손해다. 서버도 같은 조건을 들고 있다.
 */
export function canBumpPost(status: PostStatus, bumpedAt: string, now: Date): boolean {
  return status === 'selling' && toBumpRemainingMs(bumpedAt, now) === 0;
}

/**
 * 남은 시간을 사람이 읽는 문구로. 끌올할 수 있으면 null이다.
 *
 * 분 단위까지만 적는다. 초까지 적으면 화면을 다시 그리지 않는 한 곧바로 거짓말이 된다.
 * 1분도 안 남았으면 "곧" — 0분 뒤라고 적어 두면 눌러도 되는 줄 안다.
 */
export function toBumpRemainingText(bumpedAt: string, now: Date): string | null {
  const remaining = toBumpRemainingMs(bumpedAt, now);
  if (remaining === 0) {
    return null;
  }

  const hours = Math.floor(remaining / HOUR_MS);
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);

  if (hours > 0) {
    return `${hours}시간 뒤에 다시 끌어올릴 수 있어요`;
  }
  if (minutes > 0) {
    return `${minutes}분 뒤에 다시 끌어올릴 수 있어요`;
  }

  return '곧 다시 끌어올릴 수 있어요';
}
