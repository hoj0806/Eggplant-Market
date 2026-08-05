import { useState, type FormEvent } from 'react';
import TextArea from '../../../shared/ui/textArea';
import {
  COMMENT_MAX_LENGTH,
  hasCommentFieldError,
  validateCommentValues,
} from '../utils/validateCommentInput';
import type { CommentFieldErrors } from '../types';

type CommentFormProps = {
  /**
   * 입력칸의 id이자 label이 가리키는 곳. 답글 폼이 열리면 한 화면에 폼이 둘이 되므로
   * 부모가 서로 다른 값을 준다 — 같으면 label 클릭이 엉뚱한 칸으로 간다.
   */
  fieldId: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  isPending: boolean;
  /** 답글 폼에만 온다. 있으면 취소 버튼이 붙는다. */
  onCancel?(): void;
  onSubmit(content: string): void;
};

/**
 * 댓글 · 답글 입력.
 *
 * 값을 저장하지 않는다 — 어디에 보낼지는 부모가 안다(TradePlacePicker·RegionPicker와 같은 결).
 * 보내고 나서 칸을 비우는 일도 부모가 성공을 확인한 뒤 `key`를 바꿔 시킨다. 여기서 미리
 * 비우면 실패했을 때 쓴 글이 사라진다.
 *
 * 답글용을 따로 만들지 않았다. 다른 것은 문구와 취소 버튼뿐이고 검사·비우기·오류 표시는
 * 같은데, 나누면 그 셋이 두 벌이 된다.
 */
function CommentForm(props: CommentFormProps) {
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<CommentFieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextErrors = validateCommentValues(content);
    setErrors(nextErrors);
    if (hasCommentFieldError(nextErrors)) {
      return;
    }

    props.onSubmit(content.trim());
  }

  function handleChange(value: string): void {
    setContent(value);
    // 한 번 오류를 본 뒤에는 고치는 즉시 사라져야 한다. 제출까지 기다리면 이미 고친 글에
    // 빨간 문구가 남아 무엇이 문제인지 다시 읽게 된다.
    if (hasCommentFieldError(errors)) {
      setErrors(validateCommentValues(value));
    }
  }

  function handleCancel(): void {
    if (props.onCancel !== undefined) {
      props.onCancel();
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-2">
      <TextArea
        id={props.fieldId}
        label={props.label}
        value={content}
        placeholder={props.placeholder}
        rows={2}
        maxLength={COMMENT_MAX_LENGTH}
        errorMessage={errors.content}
        disabled={props.isPending}
        onValueChange={handleChange}
      />

      <div className="flex justify-end gap-2">
        {props.onCancel !== undefined ? (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition
                       hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
          >
            취소
          </button>
        ) : null}
        <button
          type="submit"
          disabled={props.isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white
                     transition hover:bg-emerald-700 disabled:cursor-not-allowed
                     disabled:opacity-60"
        >
          {props.isPending ? '등록 중…' : props.submitLabel}
        </button>
      </div>
    </form>
  );
}

export default CommentForm;
