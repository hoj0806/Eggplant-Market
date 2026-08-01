import type { ChangeEvent } from 'react';

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  description?: string;
  maxLength?: number;
  errorMessage?: string;
  disabled?: boolean;
  autoComplete?: string;
  onValueChange(value: string): void;
};

const BASE_INPUT_CLASS =
  'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition ' +
  'bg-white text-gray-900 placeholder:text-gray-400 ' +
  'focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 ' +
  'dark:bg-gray-900 dark:text-gray-50 dark:placeholder:text-gray-500';

/** 일반 텍스트 입력. 인증 폼 전용인 authTextField와 달리 기능 화면 전반에서 쓴다. */
function TextField(props: TextFieldProps) {
  const errorId = `${props.id}-error`;
  const descriptionId = `${props.id}-description`;
  const hasError = props.errorMessage !== undefined;
  const hasDescription = props.description !== undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    props.onValueChange(event.target.value);
  }

  function buildDescribedBy(): string | undefined {
    const ids: string[] = [];
    if (hasDescription) {
      ids.push(descriptionId);
    }
    if (hasError) {
      ids.push(errorId);
    }
    return ids.length > 0 ? ids.join(' ') : undefined;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={props.id}
        className="text-sm font-medium text-gray-700 dark:text-gray-200"
      >
        {props.label}
      </label>
      <input
        id={props.id}
        name={props.id}
        type="text"
        value={props.value}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        autoComplete={props.autoComplete}
        disabled={props.disabled === true}
        aria-invalid={hasError}
        aria-describedby={buildDescribedBy()}
        onChange={handleChange}
        className={`${BASE_INPUT_CLASS} ${
          hasError
            ? 'border-red-500 focus:ring-red-500/40'
            : 'border-gray-300 dark:border-gray-700'
        }`}
      />
      {hasDescription ? (
        <p id={descriptionId} className="text-xs text-gray-500 dark:text-gray-400">
          {props.description}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {props.errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export default TextField;
