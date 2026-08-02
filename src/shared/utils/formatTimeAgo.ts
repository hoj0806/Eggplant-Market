// 게시물 목록·상세에 쓰는 "n분 전" 표기.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/**
 * 시각을 지금 기준의 한국어 상대 표기로 바꾼다.
 *
 * `now`를 인자로 받는 이유는 테스트 때문만이 아니다 — 목록의 카드 여럿이 같은 기준으로
 * 계산돼야 "3분 전"과 "2분 전"이 뒤섞이지 않는다.
 * 미래 시각(기기 시계가 어긋난 경우)은 '방금 전'으로 뭉갠다.
 */
export function formatTimeAgo(isoDate: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(isoDate).getTime();

  if (Number.isNaN(elapsed) || elapsed < MINUTE_MS) {
    return '방금 전';
  }
  if (elapsed < HOUR_MS) {
    return `${Math.floor(elapsed / MINUTE_MS)}분 전`;
  }
  if (elapsed < DAY_MS) {
    return `${Math.floor(elapsed / HOUR_MS)}시간 전`;
  }
  if (elapsed < MONTH_MS) {
    return `${Math.floor(elapsed / DAY_MS)}일 전`;
  }
  if (elapsed < YEAR_MS) {
    return `${Math.floor(elapsed / MONTH_MS)}개월 전`;
  }

  return `${Math.floor(elapsed / YEAR_MS)}년 전`;
}
