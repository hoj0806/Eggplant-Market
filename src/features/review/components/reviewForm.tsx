import { useState, type FormEvent } from 'react';
import SubmitButton from '../../../shared/ui/submitButton';
import TextArea from '../../../shared/ui/textArea';
import {
  MAX_MANNER_TAGS,
  REVIEW_RATING_EMOJI,
  REVIEW_RATING_LABEL,
  REVIEW_RATING_ORDER,
  toMannerTagOptions,
  toggleMannerTag,
} from '../utils/reviewRating';
import {
  hasReviewFieldError,
  MAX_REVIEW_COMMENT_LENGTH,
  validateReviewInput,
} from '../utils/validateReviewInput';
import type { ReviewFieldErrors, ReviewFormValues, ReviewRating } from '../types';

type ReviewFormProps = {
  /** 후기를 받을 사람. 문구에 이름이 들어가야 누구를 평가하는지 헷갈리지 않는다. */
  targetNickname: string;
  isSubmitting: boolean;
  /** 저장에 실패했을 때 서버가 준 문구. 없으면 null. */
  errorMessage: string | null;
  onSubmit(values: ReviewFormValues): void;
};

const RATING_BASE_CLASS =
  'flex flex-1 flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm font-medium transition';
const RATING_SELECTED_CLASS = 'border-emerald-600 bg-emerald-50 text-emerald-700 ' +
  'dark:bg-emerald-950 dark:text-emerald-300';
const RATING_UNSELECTED_CLASS =
  'border-gray-300 text-gray-700 hover:bg-gray-50 ' +
  'dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

const TAG_BASE_CLASS = 'rounded-full border px-3 py-1.5 text-sm transition';
const TAG_SELECTED_CLASS = 'border-emerald-600 bg-emerald-600 text-white';
const TAG_UNSELECTED_CLASS =
  'border-gray-300 text-gray-700 hover:bg-gray-50 ' +
  'dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

/**
 * 후기 작성 폼.
 *
 * 평가 → 태그 → 한 줄 순서다. 앞에서 뒤로 갈수록 쓰는 품이 늘고, 뒤의 둘은 건너뛸 수 있다 —
 * 평가 하나만 누르고 보내도 후기가 된다. 매너온도를 움직이는 것은 평가뿐이고,
 * 쓸 말을 강요하면 아무도 남기지 않는다.
 *
 * 평가를 바꾸면 고른 태그를 지운다. 좋음·보통과 나쁨이 서로 다른 목록을 쓰기 때문에
 * ("좋아요"에 "약속을 안 지켜요"가 붙은 후기는 읽는 사람이 해석할 수 없다) 남겨 둘 수 없다.
 */
function ReviewForm(props: ReviewFormProps) {
  const [rating, setRating] = useState<ReviewRating>('good');
  const [mannerTags, setMannerTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ReviewFieldErrors>({});

  const tagOptions = toMannerTagOptions(rating);

  function handleSelectRating(value: ReviewRating): void {
    if (value === rating) {
      return;
    }
    setRating(value);
    setMannerTags([]);
  }

  function handleToggleTag(tag: string): void {
    setMannerTags(function toggle(current: string[]): string[] {
      return toggleMannerTag(current, tag);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const values: ReviewFormValues = { rating, mannerTags, comment };
    const errors = validateReviewInput(values);
    setFieldErrors(errors);

    if (hasReviewFieldError(errors)) {
      return;
    }

    props.onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          {props.targetNickname}님과의 거래는 어떠셨나요?
        </legend>

        <div className="flex gap-2">
          {REVIEW_RATING_ORDER.map(function renderRating(value: ReviewRating) {
            const isSelected = value === rating;

            return (
              <button
                key={value}
                type="button"
                aria-pressed={isSelected}
                disabled={props.isSubmitting}
                onClick={function selectRating(): void {
                  handleSelectRating(value);
                }}
                className={`${RATING_BASE_CLASS} ${
                  isSelected ? RATING_SELECTED_CLASS : RATING_UNSELECTED_CLASS
                }`}
              >
                <span aria-hidden="true" className="text-xl">
                  {REVIEW_RATING_EMOJI[value]}
                </span>
                {REVIEW_RATING_LABEL[value]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          어떤 점이 그랬나요? (선택, {MAX_MANNER_TAGS}개까지)
        </legend>

        <div className="flex flex-wrap gap-2">
          {tagOptions.map(function renderTag(tag: string) {
            const isSelected = mannerTags.includes(tag);

            return (
              <button
                key={tag}
                type="button"
                aria-pressed={isSelected}
                disabled={props.isSubmitting}
                onClick={function selectTag(): void {
                  handleToggleTag(tag);
                }}
                className={`${TAG_BASE_CLASS} ${
                  isSelected ? TAG_SELECTED_CLASS : TAG_UNSELECTED_CLASS
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {fieldErrors.mannerTags === undefined ? null : (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.mannerTags}
          </p>
        )}
      </fieldset>

      <TextArea
        id="review-comment"
        label="한 줄 후기 (선택)"
        value={comment}
        placeholder="거래하며 좋았던 점이나 아쉬웠던 점을 남겨 주세요."
        maxLength={MAX_REVIEW_COMMENT_LENGTH}
        rows={4}
        disabled={props.isSubmitting}
        errorMessage={fieldErrors.comment}
        onValueChange={setComment}
      />

      {props.errorMessage === null ? null : (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {props.errorMessage}
        </p>
      )}

      <SubmitButton label="후기 남기기" pendingLabel="남기는 중…" isPending={props.isSubmitting} />
    </form>
  );
}

export default ReviewForm;
