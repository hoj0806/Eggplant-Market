import type { ChangeEvent } from 'react';

type TextAreaProps = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  description?: string;
  maxLength?: number;
  rows?: number;
  errorMessage?: string;
  disabled?: boolean;
  onValueChange(value: string): void;
};

const DEFAULT_ROWS = 6;

const BASE_CLASS =
  'w-full resize-y rounded-lg border px-3 py-2.5 text-sm outline-none transition ' +
  'bg-white text-gray-900 placeholder:text-gray-400 ' +
  'focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 ' +
  'dark:bg-gray-900 dark:text-gray-50 dark:placeholder:text-gray-500';

/** 여러 줄 입력. 구조는 TextField와 같고 요소만 textarea다. */
function TextArea(props: TextAreaProps) {
  const errorId = `${props.id}-error`;
  const descriptionId = `${props.id}-description`;
  const hasError = props.errorMessage !== undefined;
  const hasDescription = props.description !== undefined;

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
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
      <label htmlFor={props.id} className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {props.label}
      </label>
      <textarea
        id={props.id}
        name={props.id}
        value={props.value}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        rows={props.rows ?? DEFAULT_ROWS}
        disabled={props.disabled === true}
        aria-invalid={hasError}
        aria-describedby={buildDescribedBy()}
        onChange={handleChange}
        className={`${BASE_CLASS} ${
          hasError ? 'border-red-500 focus:ring-red-500/40' : 'border-gray-300 dark:border-gray-700'
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

export default TextArea;
