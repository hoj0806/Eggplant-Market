import { formatTimeAgo } from './formatTimeAgo';

const NOW = new Date('2026-08-02T12:00:00.000Z');

function isoBefore(milliseconds: number): string {
  return new Date(NOW.getTime() - milliseconds).toISOString();
}

describe('formatTimeAgo', function formatTimeAgoSuite() {
  it('1분 미만은 방금 전이다', function justNowCase() {
    expect(formatTimeAgo(isoBefore(30 * 1000), NOW)).toBe('방금 전');
  });

  it('분·시간·일·개월·년 단위로 내림해서 보여준다', function unitsCase() {
    expect(formatTimeAgo(isoBefore(5 * 60 * 1000), NOW)).toBe('5분 전');
    expect(formatTimeAgo(isoBefore(3 * 60 * 60 * 1000), NOW)).toBe('3시간 전');
    expect(formatTimeAgo(isoBefore(2 * 24 * 60 * 60 * 1000), NOW)).toBe('2일 전');
    expect(formatTimeAgo(isoBefore(60 * 24 * 60 * 60 * 1000), NOW)).toBe('2개월 전');
    expect(formatTimeAgo(isoBefore(400 * 24 * 60 * 60 * 1000), NOW)).toBe('1년 전');
  });

  it('미래 시각은 방금 전으로 본다', function futureCase() {
    expect(formatTimeAgo(new Date(NOW.getTime() + 60 * 1000).toISOString(), NOW)).toBe('방금 전');
  });

  it('날짜가 아니면 방금 전으로 본다', function invalidCase() {
    expect(formatTimeAgo('어제쯤', NOW)).toBe('방금 전');
  });
});
