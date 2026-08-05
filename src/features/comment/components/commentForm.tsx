import { useState, type FormEvent } from 'react';
import TextArea from '../../../shared/ui/textArea';
import {
  COMMENT_MAX_LENGTH,
  hasCommentFieldError,
  validateCommentValues,
} from '../utils/validateCommentInput';
import type { CommentFieldErrors } from '../types';

type CommentFormProps = {
  isPending: boolean;
  onSubmit(content: string): void;
};

/**
 * 댓글 입력.
 *
 * 값을 저장하지 않는다 — 어디에 보낼지는 부모가 안다(TradePlacePicker·RegionPicker와 같은 결).
 * 보내고 나서 칸을 비우는 일도 부모가 성공을 확인한 뒤 `key`를 바꿔 시킨다. 여기서 미리
 * 비우면 실패했을 때 쓴 글이 사라진다.
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

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-2">
      <TextArea
        id="comment-content"
        label="댓글"
        value={content}
        placeholder="궁금한 점을 물어보세요."
        rows={2}
        maxLength={COMMENT_MAX_LENGTH}
        errorMessage={errors.content}
        disabled={props.isPending}
        onValueChange={handleChange}
      />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={props.isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white
                     transition hover:bg-emerald-700 disabled:cursor-not-allowed
                     disabled:opacity-60"
        >
          {props.isPending ? '등록 중…' : '댓글 등록'}
        </button>
      </div>
    </form>
  );
}

export default CommentForm;
