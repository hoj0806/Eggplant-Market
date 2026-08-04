import { MAX_MANNER_TAGS } from './reviewRating';
import type { ReviewFieldErrors, ReviewFormValues } from '../types';

/** 0013의 reviews_comment_bounded와 같은 값이다. 서버가 막기 전에 화면이 먼저 말해 준다. */
export const MAX_REVIEW_COMMENT_LENGTH = 300;

/**
 * 후기 입력 검사.
 *
 * 평가는 검사하지 않는다 — 셋 중 하나가 언제나 골라져 있는 라디오라 비어 있을 수 없다.
 * 태그도 한 줄 후기도 선택이다. 아무것도 안 쓰고 "좋아요"만 눌러도 후기가 된다 —
 * 매너온도를 올리는 데는 그것으로 충분하고, 쓸 말을 강요하면 아무도 남기지 않는다.
 */
export function validateReviewInput(values: ReviewFormValues): ReviewFieldErrors {
  const errors: ReviewFieldErrors = {};

  if (values.mannerTags.length > MAX_MANNER_TAGS) {
    errors.mannerTags = `매너 태그는 ${MAX_MANNER_TAGS}개까지 고를 수 있어요.`;
  }

  if (values.comment.trim().length > MAX_REVIEW_COMMENT_LENGTH) {
    errors.comment = `한 줄 후기는 ${MAX_REVIEW_COMMENT_LENGTH}자까지 쓸 수 있어요.`;
  }

  return errors;
}

export function hasReviewFieldError(errors: ReviewFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
