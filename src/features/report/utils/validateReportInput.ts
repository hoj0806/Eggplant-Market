import { isReportReasonAllowed } from './reportReason';
import type { ReportFieldErrors, ReportFormValues, ReportTargetType } from '../types';

/** 0014의 reports_detail_bounded와 같은 값이다. 서버가 막기 전에 화면이 먼저 말해 준다. */
export const MAX_REPORT_DETAIL_LENGTH = 500;

/** "기타"를 골랐을 때 요구하는 최소 분량. 한 글자짜리 설명은 없는 것과 같다. */
export const MIN_OTHER_REASON_DETAIL_LENGTH = 5;

/**
 * 신고 입력 검사.
 *
 * 후기(validateReviewInput)와 반대로 **사유는 반드시 골라야 한다.** 후기는 평가가 늘 하나
 * 켜져 있는 라디오였지만, 신고는 아무것도 안 골라진 상태로 열린다 — 실수로 열었다가
 * 그대로 보내는 일을 막으려고 일부러 그렇게 뒀다.
 *
 * "기타"만 상세를 요구한다. 나머지 사유는 문장 자체가 이미 무슨 일인지 말하고 있어
 * 설명을 강요하면 신고를 접는다. 기타는 그 문장이 없으므로 읽을 것이 있어야 한다.
 */
export function validateReportInput(
  values: ReportFormValues,
  targetType: ReportTargetType,
): ReportFieldErrors {
  const errors: ReportFieldErrors = {};
  const detail = values.detail.trim();

  if (!isReportReasonAllowed(targetType, values.reason)) {
    errors.reason = '신고 사유를 골라 주세요.';
  } else if (values.reason === 'other' && detail.length < MIN_OTHER_REASON_DETAIL_LENGTH) {
    errors.detail = `기타를 고르셨다면 무슨 일인지 ${MIN_OTHER_REASON_DETAIL_LENGTH}자 이상 적어 주세요.`;
  }

  if (detail.length > MAX_REPORT_DETAIL_LENGTH) {
    errors.detail = `상세 내용은 ${MAX_REPORT_DETAIL_LENGTH}자까지 쓸 수 있어요.`;
  }

  return errors;
}

export function hasReportFieldError(errors: ReportFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
