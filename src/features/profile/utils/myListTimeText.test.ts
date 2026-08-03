import { toMyListTimeText } from './myListTimeText';

const NOW = new Date('2026-08-03T12:00:00.000Z');
const THREE_DAYS_AGO = '2026-07-31T12:00:00.000Z';

describe('toMyListTimeText', function myListTimeTextSuite() {
  it('관심목록은 찜한 지 얼마나 됐는지 알려 준다', function likesCase() {
    expect(toMyListTimeText('likes', THREE_DAYS_AGO, NOW)).toBe('3일 전 찜');
  });

  it('최근 본 글은 언제 봤는지 알려 준다', function recentCase() {
    expect(toMyListTimeText('recent', THREE_DAYS_AGO, NOW)).toBe('3일 전 봄');
  });

  it('구매내역은 상대 표기가 아니라 날짜다 — 기록이라 언제 샀는지가 남아야 한다', function purchasesCase() {
    // 로컬 시간대 기준으로 읽히므로 날짜 세 조각을 직접 만들어 비교한다.
    const soldAt = new Date('2026-07-30T05:00:00.000Z');
    const expected = `${soldAt.getFullYear()}년 ${soldAt.getMonth() + 1}월 ${soldAt.getDate()}일 구매`;

    expect(toMyListTimeText('purchases', soldAt.toISOString(), NOW)).toBe(expected);
  });

  it('판매관리는 카드 기본값(끌올 시각)을 그대로 쓴다', function salesCase() {
    expect(toMyListTimeText('sales', THREE_DAYS_AGO, NOW)).toBeUndefined();
  });

  it('구매 시각이 깨져 있어도 목록이 죽지 않는다', function brokenDateCase() {
    expect(toMyListTimeText('purchases', 'not-a-date', NOW)).toBe('구매 완료');
  });
});
