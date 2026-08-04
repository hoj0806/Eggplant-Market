import { canBumpPost, toBumpRemainingMs, toBumpRemainingText } from './postBumpCooldown';

const NOW = new Date('2026-08-04T12:00:00.000Z');

/** NOW로부터 hours시간 전 시각. 음수를 넣으면 미래다. */
function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60 * 1000).toISOString();
}

describe('toBumpRemainingMs', function remainingSuite() {
  it('24시간이 지났으면 0이다', function readyCase() {
    expect(toBumpRemainingMs(hoursAgo(25), NOW)).toBe(0);
  });

  it('딱 24시간이면 0이다 — 경계에서 한 번 더 기다리게 하지 않는다', function boundaryCase() {
    expect(toBumpRemainingMs(hoursAgo(24), NOW)).toBe(0);
  });

  it('아직이면 남은 시간을 ms로 돌려준다', function waitingCase() {
    expect(toBumpRemainingMs(hoursAgo(20), NOW)).toBe(4 * 60 * 60 * 1000);
  });
});

describe('canBumpPost', function canBumpSuite() {
  it('판매중이고 24시간이 지났으면 끌어올릴 수 있다', function sellingCase() {
    expect(canBumpPost('selling', hoursAgo(25), NOW)).toBe(true);
  });

  it('쿨다운 중에는 막는다', function cooldownCase() {
    expect(canBumpPost('selling', hoursAgo(1), NOW)).toBe(false);
  });

  // 예약중·거래완료된 글이 홈 맨 위로 올라오면 목록을 훑는 사람에게 손해다. 서버도 같은 조건이다.
  it('판매중이 아니면 시간이 지났어도 막는다', function notSellingCase() {
    expect(canBumpPost('reserved', hoursAgo(100), NOW)).toBe(false);
    expect(canBumpPost('sold', hoursAgo(100), NOW)).toBe(false);
  });
});

describe('toBumpRemainingText', function textSuite() {
  it('끌어올릴 수 있으면 적을 말이 없다', function readyCase() {
    expect(toBumpRemainingText(hoursAgo(30), NOW)).toBeNull();
  });

  it('한 시간이 넘게 남았으면 시간 단위로 적는다', function hoursCase() {
    expect(toBumpRemainingText(hoursAgo(20), NOW)).toBe('4시간 뒤에 다시 끌어올릴 수 있어요');
  });

  it('한 시간이 안 남았으면 분 단위로 적는다', function minutesCase() {
    expect(toBumpRemainingText(minutesAgo(24 * 60 - 30), NOW)).toBe(
      '30분 뒤에 다시 끌어올릴 수 있어요',
    );
  });

  // 0분 뒤라고 적어 두면 눌러도 되는 줄 안다.
  it('1분도 안 남았으면 "곧"이라고 적는다', function soonCase() {
    const thirtySecondsLeft = new Date(NOW.getTime() - 24 * 60 * 60 * 1000 + 30_000).toISOString();

    expect(toBumpRemainingText(minutesAgo(24 * 60 - 1), NOW)).toBe(
      '1분 뒤에 다시 끌어올릴 수 있어요',
    );
    expect(toBumpRemainingText(thirtySecondsLeft, NOW)).toBe('곧 다시 끌어올릴 수 있어요');
  });
});
