import {
  hasReviewFieldError,
  MAX_REVIEW_COMMENT_LENGTH,
  validateReviewInput,
} from './validateReviewInput';
import { MAX_MANNER_TAGS } from './reviewRating';
import type { ReviewFormValues } from '../types';

function toValues(overrides: Partial<ReviewFormValues> = {}): ReviewFormValues {
  return { rating: 'good', mannerTags: [], comment: '', ...overrides };
}

describe('validateReviewInput', function validateSuite() {
  it('평가만 고르고 나머지를 비워도 통과한다', function ratingOnly() {
    const errors = validateReviewInput(toValues());

    expect(hasReviewFieldError(errors)).toBe(false);
  });

  it('태그가 정해진 개수를 넘으면 막는다', function tooManyTags() {
    const tags = Array.from({ length: MAX_MANNER_TAGS + 1 }, function toTag(_u, index: number) {
      return `태그${index}`;
    });

    expect(validateReviewInput(toValues({ mannerTags: tags })).mannerTags).toBeDefined();
  });

  it('한 줄 후기가 길면 막는다', function tooLongComment() {
    const comment = 'ㄱ'.repeat(MAX_REVIEW_COMMENT_LENGTH + 1);

    expect(validateReviewInput(toValues({ comment })).comment).toBeDefined();
  });

  it('앞뒤 공백은 길이로 세지 않는다', function trimsBeforeMeasuring() {
    const comment = `  ${'ㄱ'.repeat(MAX_REVIEW_COMMENT_LENGTH)}  `;

    expect(validateReviewInput(toValues({ comment })).comment).toBeUndefined();
  });
});
