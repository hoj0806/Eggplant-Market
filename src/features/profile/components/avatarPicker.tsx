import { useEffect, useState, type ChangeEvent } from 'react';
import ProfileAvatar from './profileAvatar';
import { ALLOWED_AVATAR_TYPES } from '../utils/validateProfileInput';

type AvatarPickerProps = {
  nickname: string;
  file: File | null;
  errorMessage?: string;
  disabled?: boolean;
  onFileChange(file: File | null): void;
};

const INPUT_ID = 'avatarFile';
const ERROR_ID = 'avatarFile-error';

function AvatarPicker(props: AvatarPickerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const hasError = props.errorMessage !== undefined;

  useEffect(
    function syncPreviewUrl() {
      if (props.file === null) {
        setPreviewUrl(null);
        return;
      }

      const objectUrl = URL.createObjectURL(props.file);
      setPreviewUrl(objectUrl);

      return function revokePreviewUrl(): void {
        URL.revokeObjectURL(objectUrl);
      };
    },
    [props.file],
  );

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const selected = event.target.files?.[0] ?? null;
    // 같은 파일을 다시 골라도 change가 일어나도록 입력값을 비운다.
    event.target.value = '';
    props.onFileChange(selected);
  }

  function handleReset(): void {
    props.onFileChange(null);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <ProfileAvatar nickname={props.nickname} avatarUrl={previewUrl} size="lg" />

      <div className="flex items-center gap-2">
        <label
          htmlFor={INPUT_ID}
          className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium
                     text-gray-700 transition hover:bg-gray-50
                     dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          사진 선택
        </label>
        {props.file !== null ? (
          <button
            type="button"
            onClick={handleReset}
            disabled={props.disabled === true}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition
                       hover:text-gray-700 disabled:opacity-60 dark:text-gray-400 dark:hover:text-gray-200"
          >
            기본 이미지 사용
          </button>
        ) : null}
      </div>

      <input
        id={INPUT_ID}
        name={INPUT_ID}
        type="file"
        accept={ALLOWED_AVATAR_TYPES.join(',')}
        disabled={props.disabled === true}
        aria-label="프로필 사진"
        aria-invalid={hasError}
        aria-describedby={hasError ? ERROR_ID : undefined}
        onChange={handleChange}
        className="sr-only"
      />

      <p className="text-xs text-gray-500 dark:text-gray-400">
        선택하지 않으면 기본 이미지가 사용됩니다. 나중에 언제든 바꿀 수 있어요.
      </p>

      {hasError ? (
        <p id={ERROR_ID} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {props.errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export default AvatarPicker;
