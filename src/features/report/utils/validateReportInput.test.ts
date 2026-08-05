import {
  hasReportFieldError,
  MAX_REPORT_DETAIL_LENGTH,
  MIN_OTHER_REASON_DETAIL_LENGTH,
  validateReportInput,
} from './validateReportInput';
import type { ReportFormValues } from '../types';

function makeValues(overrides: Partial<ReportFormValues> = {}): ReportFormValues {
  return {
    reason: overrides.reason === undefined ? 'fraud' : overrides.reason,
    detail: overrides.detail ?? '',
  };
}

describe('validateReportInput', function validateReportInputSuite() {
  it('사유를 고르지 않으면 보낼 수 없다', function requiresReason() {
    // 실수로 열었다가 그대로 보내는 일을 막으려고 아무것도 안 골라진 채로 연다.
    const errors = validateReportInput(makeValues({ reason: null }), 'post');

    expect(errors.reason).toBe('신고 사유를 골라 주세요.');
    expect(hasReportFieldError(errors)).toBe(true);
  });

  it('대상에 없는 사유는 고르지 않은 것과 같다', function rejectsForeignReason() {
    const errors = validateReportInput(makeValues({ reason: 'prohibited' }), 'user');

    expect(errors.reason).toBe('신고 사유를 골라 주세요.');
  });

  it('사유만 고르면 상세 없이도 보낼 수 있다', function detailIsOptional() {
    const errors = validateReportInput(makeValues({ reason: 'fraud', detail: '' }), 'post');

    expect(hasReportFieldError(errors)).toBe(false);
  });

  it('"기타"는 무슨 일인지 적어야 한다', function otherNeedsDetail() {
    // 다른 사유는 문장 자체가 이미 무슨 일인지 말하지만 기타는 그 문장이 없다.
    const errors = validateReportInput(makeValues({ reason: 'other', detail: '이상' }), 'post');

    expect(errors.detail).toContain(`${MIN_OTHER_REASON_DETAIL_LENGTH}자 이상`);
  });

  it('"기타"의 상세는 공백을 걷어내고 센다', function otherTrimsDetail() {
    const spaces = ' '.repeat(MIN_OTHER_REASON_DETAIL_LENGTH + 3);
    const errors = validateReportInput(makeValues({ reason: 'other', detail: spaces }), 'post');

    expect(errors.detail).toBeDefined();
  });

  it('"기타"에 충분히 적으면 통과한다', function otherWithDetailPasses() {
    const errors = validateReportInput(
      makeValues({ reason: 'other', detail: '거래 도중 협박을 했어요' }),
      'post',
    );

    expect(hasReportFieldError(errors)).toBe(false);
  });

  it('상세가 서버 한도를 넘으면 미리 막는다', function boundsDetail() {
    // 0014의 reports_detail_bounded와 같은 값이다. 서버가 막기 전에 화면이 먼저 말해 준다.
    const tooLong = '가'.repeat(MAX_REPORT_DETAIL_LENGTH + 1);
    const errors = validateReportInput(makeValues({ detail: tooLong }), 'post');

    expect(errors.detail).toContain(`${MAX_REPORT_DETAIL_LENGTH}자까지`);
  });

  it('한도에 딱 맞으면 통과한다', function allowsExactLimit() {
    const exact = '가'.repeat(MAX_REPORT_DETAIL_LENGTH);
    const errors = validateReportInput(makeValues({ detail: exact }), 'post');

    expect(hasReportFieldError(errors)).toBe(false);
  });
});
