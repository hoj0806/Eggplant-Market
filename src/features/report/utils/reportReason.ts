import type { ReportReason, ReportTargetType } from '../types';

export type ReportReasonOption = {
  value: ReportReason;
  label: string;
};

/**
 * 게시물 신고 사유.
 *
 * 순서는 실제로 많이 눌리는 것부터다. "기타"는 언제나 맨 아래에 둔다 —
 * 위에 있으면 읽지 않고 고르게 되고, 그러면 사유 목록이 있으나 마나다.
 */
const POST_REPORT_REASONS: ReadonlyArray<ReportReasonOption> = [
  { value: 'prohibited', label: '전문판매업자예요 / 판매금지 물품이에요' },
  { value: 'fraud', label: '사기가 의심돼요' },
  { value: 'spam', label: '광고·도배 글이에요' },
  { value: 'inappropriate', label: '부적절한 내용이 담겨 있어요' },
  { value: 'other', label: '기타' },
];

/**
 * 사용자 신고 사유.
 *
 * 게시물 쪽과 겹치는 값(fraud·spam)이 있지만 문구가 다르다 — 신고하는 사람이 보는 것은
 * 코드가 아니라 문장이고, "광고 글이에요"와 "광고를 보내요"는 다른 일이다.
 * 판매금지 물품(prohibited)은 글에 붙는 사유라 여기에 없다.
 */
const USER_REPORT_REASONS: ReadonlyArray<ReportReasonOption> = [
  { value: 'fraud', label: '사기가 의심돼요' },
  { value: 'abuse', label: '욕설·비방을 해요' },
  { value: 'spam', label: '광고·도배를 보내요' },
  { value: 'inappropriate', label: '프로필에 부적절한 내용이 있어요' },
  { value: 'other', label: '기타' },
];

export function toReportReasonOptions(
  targetType: ReportTargetType,
): ReadonlyArray<ReportReasonOption> {
  return targetType === 'post' ? POST_REPORT_REASONS : USER_REPORT_REASONS;
}

/** 이 대상에 고를 수 있는 사유인가. 시트가 대상을 바꿔 그릴 때 고른 값이 남아 있는지 본다. */
export function isReportReasonAllowed(
  targetType: ReportTargetType,
  reason: ReportReason | null,
): boolean {
  if (reason === null) {
    return false;
  }

  return toReportReasonOptions(targetType).some(function hasReason(
    option: ReportReasonOption,
  ): boolean {
    return option.value === reason;
  });
}

/** 신고 대상을 가리키는 말. "이 게시물을 신고합니다"와 "이 사용자를…"이 달라야 한다. */
export function toReportTargetNoun(targetType: ReportTargetType): string {
  return targetType === 'post' ? '게시물' : '사용자';
}
