import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
import type { MyListKind } from '../types';

/**
 * 목록 카드에 적을 시간 문구.
 *
 * 같은 카드라도 어느 목록에 있느냐에 따라 시각의 뜻이 다르다. 홈·검색에서는 "언제 올라온 글인가"라
 * 끌올 시각을 그대로 쓰지만, 마이페이지에서는 "내가 언제 이걸 했는가"가 궁금한 값이다.
 *
 * 구매내역만 상대 표기가 아니라 날짜다. 나머지 셋은 최근 흐름을 보는 목록이라 "3일 전"이 읽기 좋지만,
 * 구매내역은 기록에 가까워 "언제 샀는지"가 날짜로 남아야 쓸모가 있다.
 * 판매관리는 끌올 시각이 곧 정렬 기준이라 홈과 같은 표기를 그대로 쓴다(undefined = 카드 기본값).
 */
export function toMyListTimeText(
  kind: MyListKind,
  sortAt: string,
  now: Date = new Date(),
): string | undefined {
  if (kind === 'sales') {
    return undefined;
  }

  if (kind === 'purchases') {
    const dateText = toDateText(sortAt);
    return dateText === '' ? '구매 완료' : `${dateText} 구매`;
  }

  const timeAgo = formatTimeAgo(sortAt, now);

  return kind === 'likes' ? `${timeAgo} 찜` : `${timeAgo} 봄`;
}

/** 값이 깨져 있으면 날짜 칸을 비운다 — 시간 표기 때문에 목록이 죽으면 안 된다. */
function toDateText(isoDate: string): string {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}
