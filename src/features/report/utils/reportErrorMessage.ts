// 신고 저장 실패를 사용자에게 보여줄 한국어 문구로 바꾼다.

import { matchErrorMessage } from '../../../shared/utils/errorText';

const DEFAULT_REPORT_ERROR_MESSAGE = '신고를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.';

// 순서가 곧 우선순위다. 구체적인 원인을 위에 둔다.
const MESSAGE_BY_PATTERN: ReadonlyArray<readonly [RegExp, string]> = [
  [/23505|duplicate key/, '이미 신고한 대상이에요.'],
  [/23514|check constraint/, '신고 내용이 너무 길어요. 줄여서 다시 보내 주세요.'],
  [/row-level security|permission denied|42501/, '신고는 로그인한 뒤에 할 수 있어요.'],
  [/failed to fetch|network|networkerror/, '네트워크 연결을 확인해 주세요.'],
];

const HANGUL_PATTERN = /[가-힣]/;

/** PostgrestError든 Error든 message 하나만 날것으로 꺼낸다(reviewErrorMessage와 같은 형태). */
function toRawMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error === null || typeof error !== 'object') {
    return '';
  }

  const message = (error as { message?: unknown }).message;

  return typeof message === 'string' ? message : '';
}

/**
 * 0014의 `create_report`는 거절 사유를 한국어로 구분해 던진다
 * ("이미 신고한 대상입니다.", "내 게시물은 신고할 수 없습니다.", "게시물을 찾을 수 없습니다.").
 * 그 문구가 이미 사용자에게 보여줄 말이므로 errcode로 뭉뚱그리지 않고 그대로 쓴다
 * (`toReviewErrorMessage`와 같은 판단).
 */
export function toReportErrorMessage(error: unknown): string {
  const raw = toRawMessage(error).trim();

  if (HANGUL_PATTERN.test(raw)) {
    return raw;
  }

  return matchErrorMessage(error, MESSAGE_BY_PATTERN, DEFAULT_REPORT_ERROR_MESSAGE);
}
