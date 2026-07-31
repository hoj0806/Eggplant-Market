import type { ChangeEvent } from 'react';

type AuthTextFieldProps = {
  id: string;
  label: string;
  type: 'email' | 'password';
  value: string;
  autoComplete: string;
  placeholder?: string;
  errorMessage?: string;
  disabled?: boolean;
  onValueChange(value: string): void;
};

const BASE_INPUT_CLASS =
  'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition ' +
  'bg-white text-gray-900 placeholder:text-gray-400 ' +
  'focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 ' +
  'dark:bg-gray-900 dark:text-gray-50 dark:placeholder:text-gray-500';

function AuthTextField(props: AuthTextFieldProps) {
  const errorId = `${props.id}-error`;
  const hasError = props.errorMessage !== undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    props.onValueChange(event.target.value);
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
        type={props.type}
        value={props.value}
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        disabled={props.disabled === true}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        onChange={handleChange}
        className={`${BASE_INPUT_CLASS} ${
          hasError
            ? 'border-red-500 focus:ring-red-500/40'
            : 'border-gray-300 dark:border-gray-700'
        }`}
      />
      {hasError ? (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {props.errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export default AuthTextField;
