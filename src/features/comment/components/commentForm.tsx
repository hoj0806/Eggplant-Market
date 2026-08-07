import { useState, type ChangeEvent, type FormEvent } from 'react';
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
  /** 고치기 폼에만 온다. 원래 내용을 채운 채로 연다. */
  initialContent?: string;
  isPending: boolean;
  /**
   * 참이면 "비밀 댓글" 체크칸이 붙는다. **1단 폼에만 온다** —
   * 답글의 공개 범위는 부모를 따라가고 서버가 받아 적는다(0033).
   */
  canBeSecret?: boolean;
  /** 입력칸 밑에 붙는 안내 한 줄. 지금은 비밀 댓글에 답글을 달 때만 온다. */
  note?: string;
  /** 답글 폼에만 온다. 있으면 취소 버튼이 붙는다. */
  onCancel?(): void;
  /**
   * `isSecret`은 체크칸이 있는 폼에서만 참이 될 수 있다. 없는 폼(답글·고치기)은 언제나
   * false를 주므로 받는 쪽이 "이 폼에 체크칸이 있었나"를 되물을 필요가 없다.
   */
  onSubmit(content: string, isSecret: boolean): void;
};

/**
 * 댓글 · 답글 입력.
 *
 * 값을 저장하지 않는다 — 어디에 보낼지는 부모가 안다(TradePlacePicker·RegionPicker와 같은 결).
 * 보내고 나서 칸을 비우는 일도 부모가 성공을 확인한 뒤 `key`를 바꿔 시킨다. 여기서 미리
 * 비우면 실패했을 때 쓴 글이 사라진다.
 *
 * 답글용·고치기용을 따로 만들지 않았다. 다른 것은 문구와 취소 버튼, 그리고 처음에 담긴
 * 값뿐이고 검사·비우기·오류 표시는 같은데, 나누면 그 셋이 세 벌이 된다.
 *
 * `initialContent`는 **처음 한 번만** 쓰인다(useState의 초깃값). 고치는 중에 서버에서 새 값이
 * 와도 입력칸을 덮지 않는다 — 쓰고 있던 글이 사라지는 것보다 낫다.
 *
 * 비밀 여부도 내용과 같이 여기서 들고 있다가 `onSubmit`으로 함께 올린다. 부모가 들면
 * 폼이 여럿인 화면에서 "어느 폼의 체크칸인가"를 부모가 다시 가려야 하는데, 비우는 일도
 * 부모의 `key` 갈아 끼우기가 이미 맡고 있어 그때 함께 false로 돌아간다.
 */
function CommentForm(props: CommentFormProps) {
  const [content, setContent] = useState(props.initialContent ?? '');
  const [isSecret, setIsSecret] = useState(false);
  const [errors, setErrors] = useState<CommentFieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextErrors = validateCommentValues(content);
    setErrors(nextErrors);
    if (hasCommentFieldError(nextErrors)) {
      return;
    }

    // 체크칸이 없는 폼은 언제나 false다. 감춰 둔 상태가 딸려 나가지 않는다.
    props.onSubmit(content.trim(), props.canBeSecret === true && isSecret);
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

  function handleSecretChange(event: ChangeEvent<HTMLInputElement>): void {
    setIsSecret(event.target.checked);
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

      {props.note !== undefined ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{props.note}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {props.canBeSecret === true ? (
          <label
            htmlFor={`${props.fieldId}-secret`}
            className="mr-auto flex cursor-pointer items-center gap-2 text-xs
                       font-medium text-gray-600 dark:text-gray-300"
          >
            <input
              id={`${props.fieldId}-secret`}
              name={`${props.fieldId}-secret`}
              type="checkbox"
              checked={isSecret}
              disabled={props.isPending}
              onChange={handleSecretChange}
              className="h-4 w-4 shrink-0 accent-emerald-600"
            />
            비밀 댓글
            <span className="font-normal text-gray-500 dark:text-gray-400">
              판매자와 나만 볼 수 있어요
            </span>
          </label>
        ) : null}

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
