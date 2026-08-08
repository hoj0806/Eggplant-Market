import {
  isReportReasonAllowed,
  toReportReasonOptions,
  toReportTargetNoun,
  type ReportReasonOption,
} from './reportReason';

function toValues(options: ReadonlyArray<ReportReasonOption>): string[] {
  return options.map(function pickValue(option: ReportReasonOption): string {
    return option.value;
  });
}

describe('reportReason', function reportReasonSuite() {
  it('"기타"는 언제나 맨 아래다', function otherIsLast() {
    // 위에 있으면 읽지 않고 고르게 되고, 그러면 사유 목록이 있으나 마나다.
    expect(toValues(toReportReasonOptions('post')).at(-1)).toBe('other');
    expect(toValues(toReportReasonOptions('user')).at(-1)).toBe('other');
  });

  it('판매금지 물품은 게시물에만 붙는 사유다', function prohibitedIsPostOnly() {
    expect(toValues(toReportReasonOptions('post'))).toContain('prohibited');
    expect(toValues(toReportReasonOptions('user'))).not.toContain('prohibited');
  });

  it('욕설·비방은 사용자에만 붙는 사유다', function abuseIsUserOnly() {
    expect(toValues(toReportReasonOptions('user'))).toContain('abuse');
    expect(toValues(toReportReasonOptions('post'))).not.toContain('abuse');
  });

  it('같은 코드라도 대상에 따라 문구가 다르다', function labelsDifferByTarget() {
    // 신고하는 사람이 보는 것은 코드가 아니라 문장이다.
    // "광고 글이에요"와 "광고를 보내요"는 다른 일이다.
    const postSpam = toReportReasonOptions('post').find(function isSpam(option) {
      return option.value === 'spam';
    });
    const userSpam = toReportReasonOptions('user').find(function isSpam(option) {
      return option.value === 'spam';
    });

    expect(postSpam?.label).not.toBe(userSpam?.label);
  });

  it('대상에 없는 사유는 허용하지 않는다', function rejectsForeignReason() {
    expect(isReportReasonAllowed('user', 'prohibited')).toBe(false);
    expect(isReportReasonAllowed('post', 'abuse')).toBe(false);
    expect(isReportReasonAllowed('post', 'fraud')).toBe(true);
  });

  it('아무것도 안 고른 상태는 허용하지 않는다', function rejectsNull() {
    expect(isReportReasonAllowed('post', null)).toBe(false);
  });

  it('대상을 가리키는 말이 다르다', function nounDiffers() {
    expect(toReportTargetNoun('post')).toBe('게시물');
    expect(toReportTargetNoun('user')).toBe('사용자');
  });
});
