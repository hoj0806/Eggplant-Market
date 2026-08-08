/** 신고할 수 있는 것. 0001의 `report_target` enum과 같은 값이다. */
export type ReportTargetType = 'post' | 'user';

/**
 * 신고 사유 코드. 0014의 `reports_reason_allowed`가 이 여섯만 받는다.
 *
 * 서버는 대상 종류별로 나누지 않는다 — 게시물 사유를 사용자 신고에 넣어도 위험한 일이
 * 일어나지 않고(신고는 사람이 읽는다) 그 구분은 화면이 고르는 문제다(`reportReason.ts`).
 */
export type ReportReason = 'fraud' | 'prohibited' | 'spam' | 'abuse' | 'inappropriate' | 'other';

/**
 * 신고 대상 하나.
 *
 * `id`가 문자열인 것은 게시물 번호와 사용자 uuid를 한 칸에 담는 `reports.target_id`를
 * 그대로 따랐기 때문이다. 형태 검사(숫자냐 uuid냐)는 0014의 `reports_target_id_shaped`가 한다.
 *
 * `label`은 "무엇을 신고하는 중인지" 화면에 적기 위한 것이다 — 글 제목이나 닉네임이 들어간다.
 */
export type ReportTarget = {
  type: ReportTargetType;
  id: string;
  label: string;
};

/** 신고 시트가 들고 있는 값. 사유는 처음에 아무것도 안 골라져 있다. */
export type ReportFormValues = {
  reason: ReportReason | null;
  detail: string;
};

export type ReportFieldName = 'reason' | 'detail';

export type ReportFieldErrors = Partial<Record<ReportFieldName, string>>;
