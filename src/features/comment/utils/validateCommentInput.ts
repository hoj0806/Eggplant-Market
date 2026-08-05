import type { CommentFieldErrors } from '../types';

/** 0017의 `comments_content_bounded`와 같은 값. 열이 마지막 방어선이고 여기는 첫 안내다. */
export const COMMENT_MAX_LENGTH = 1000;

/**
 * 댓글 내용 검사.
 *
 * 공백을 걷어내고 본다. 스페이스만 눌러 보낸 댓글은 서버 제약(btrim)이 어차피 막지만,
 * 거기까지 가면 사용자는 무엇이 잘못됐는지 모르는 오류를 받는다.
 *
 * 길이는 걷어내기 **전** 값으로 잰다. 저장되는 것이 원문이므로 원문이 한도 안이어야 한다.
 */
export function validateCommentContent(content: string): string | undefined {
  if (content.trim().length === 0) {
    return '댓글을 입력해 주세요.';
  }
  if (content.length > COMMENT_MAX_LENGTH) {
    return `댓글은 ${COMMENT_MAX_LENGTH}자 이하여야 합니다.`;
  }
  return undefined;
}

export function validateCommentValues(content: string): CommentFieldErrors {
  const errors: CommentFieldErrors = {};

  const contentError = validateCommentContent(content);
  if (contentError !== undefined) {
    errors.content = contentError;
  }

  return errors;
}

export function hasCommentFieldError(errors: CommentFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
