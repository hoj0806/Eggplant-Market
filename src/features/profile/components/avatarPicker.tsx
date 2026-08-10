import { useEffect, useState, type ChangeEvent } from 'react';
import ProfileAvatar from './profileAvatar';
import {
  MAX_IMAGE_SOURCE_BYTES,
  toMegabyteText,
} from '../../../shared/utils/imageSizeLimit';
import { ALLOWED_AVATAR_TYPES } from '../utils/validateProfileInput';

type AvatarPickerProps = {
  nickname: string;
  file: File | null;
  errorMessage?: string;
  disabled?: boolean;
  /**
   * 이미 저장돼 있는 사진. 온보딩에는 없고 프로필 수정에만 있다.
   * 새로 고른 파일이 없을 때 이 사진을 보여준다.
   */
  currentAvatarUrl?: string | null;
  /** true면 저장된 사진을 지우기로 한 상태다. 미리보기는 기본 이미지로 돌아간다. */
  isRemoved?: boolean;
  /** 넘기면 "기본 이미지로" 버튼이 생긴다. 온보딩은 지울 사진이 없어 넘기지 않는다. */
  onRemove?(): void;
  onFileChange(file: File | null): void;
};

const INPUT_ID = 'avatarFile';
const ERROR_ID = 'avatarFile-error';

function AvatarPicker(props: AvatarPickerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const hasError = props.errorMessage !== undefined;

  const currentAvatarUrl = props.currentAvatarUrl ?? null;
  const isRemoved = props.isRemoved === true;

  // 새로 고른 파일이 가장 세다. 없으면 되돌리기 여부를 보고 저장된 사진을 쓴다.
  const displayedUrl = previewUrl ?? (isRemoved ? null : currentAvatarUrl);

  // 지울 사진이 실제로 있을 때만 버튼을 낸다. 이미 기본 이미지인데 "기본 이미지로"는 뜻이 없다.
  const canRemove = props.onRemove !== undefined && !isRemoved && currentAvatarUrl !== null;

  // 고른 파일을 물릴 때 무엇으로 돌아가는지가 상황마다 다르다.
  // 저장된 사진이 있으면 그 사진으로, 없으면(온보딩) 기본 이미지로 돌아간다.
  const resetLabel = currentAvatarUrl !== null && !isRemoved ? '선택 취소' : '기본 이미지 사용';

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
      <ProfileAvatar nickname={props.nickname} avatarUrl={displayedUrl} size="lg" />

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
            {resetLabel}
          </button>
        ) : null}

        {canRemove ? (
          <button
            type="button"
            onClick={props.onRemove}
            disabled={props.disabled === true}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition
                       hover:text-gray-700 disabled:opacity-60 dark:text-gray-400 dark:hover:text-gray-200"
          >
            기본 이미지로
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
        {displayedUrl === null
          ? '선택하지 않으면 기본 이미지가 사용됩니다. 나중에 언제든 바꿀 수 있어요.'
          : `JPG, PNG, WEBP, GIF · ${toMegabyteText(MAX_IMAGE_SOURCE_BYTES)} 이하`}
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
