import { useEffect, useState, type ChangeEvent } from 'react';
import {
  ALLOWED_POST_IMAGE_TYPES,
  MAX_POST_IMAGE_COUNT,
} from '../utils/validatePostInput';

type PostImagePickerProps = {
  files: File[];
  errorMessage?: string;
  disabled?: boolean;
  onFilesChange(files: File[]): void;
};

const INPUT_ID = 'postImages';
const ERROR_ID = 'postImages-error';

/**
 * 상품 사진 여러 장을 고른다. 첫 장이 목록 썸네일이 되므로 그 사실을 화면에 적어 둔다.
 *
 * 미리보기 URL은 파일 목록이 바뀔 때마다 통째로 다시 만들고 이전 것을 해제한다.
 * 해제하지 않으면 사진을 여러 번 갈아 끼우는 동안 blob이 메모리에 계속 쌓인다.
 */
function PostImagePicker(props: PostImagePickerProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const hasError = props.errorMessage !== undefined;

  useEffect(
    function syncPreviewUrls() {
      const objectUrls = props.files.map(function toObjectUrl(file: File): string {
        return URL.createObjectURL(file);
      });
      setPreviewUrls(objectUrls);

      return function revokePreviewUrls(): void {
        for (const url of objectUrls) {
          URL.revokeObjectURL(url);
        }
      };
    },
    [props.files],
  );

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const selected = Array.from(event.target.files ?? []);
    // 같은 파일을 다시 골라도 change가 일어나도록 입력값을 비운다.
    event.target.value = '';

    if (selected.length === 0) {
      return;
    }

    props.onFilesChange([...props.files, ...selected]);
  }

  function handleRemove(index: number): void {
    props.onFilesChange(
      props.files.filter(function keepOthers(_file: File, current: number): boolean {
        return current !== index;
      }),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">상품 사진</span>

      <div className="flex flex-wrap gap-2">
        <label
          htmlFor={INPUT_ID}
          className="flex h-24 w-24 shrink-0 cursor-pointer flex-col items-center justify-center
                     rounded-lg border border-dashed border-gray-300 text-xs text-gray-500
                     transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400
                     dark:hover:bg-gray-800"
        >
          <span className="text-lg">＋</span>
          <span>
            {props.files.length}/{MAX_POST_IMAGE_COUNT}
          </span>
        </label>

        {previewUrls.map(function renderPreview(url: string, index: number) {
          return (
            <div key={url} className="relative h-24 w-24 shrink-0">
              <img
                src={url}
                alt={`상품 사진 ${index + 1}`}
                className="h-full w-full rounded-lg object-cover"
              />
              {index === 0 ? (
                <span
                  className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/60 py-0.5
                             text-center text-[10px] font-medium text-white"
                >
                  대표 사진
                </span>
              ) : null}
              <button
                type="button"
                disabled={props.disabled === true}
                onClick={function handleRemoveClick(): void {
                  handleRemove(index);
                }}
                aria-label={`상품 사진 ${index + 1} 삭제`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center
                           rounded-full bg-gray-900/80 text-xs text-white transition
                           hover:bg-gray-900 disabled:opacity-60"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <input
        id={INPUT_ID}
        name={INPUT_ID}
        type="file"
        multiple
        accept={ALLOWED_POST_IMAGE_TYPES.join(',')}
        disabled={props.disabled === true}
        aria-label="상품 사진 추가"
        aria-invalid={hasError}
        aria-describedby={hasError ? ERROR_ID : undefined}
        onChange={handleChange}
        className="sr-only"
      />

      <p className="text-xs text-gray-500 dark:text-gray-400">
        최대 {MAX_POST_IMAGE_COUNT}장, 한 장에 5MB까지 올릴 수 있어요. 첫 번째 사진이 목록에
        보입니다.
      </p>

      {hasError ? (
        <p id={ERROR_ID} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {props.errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export default PostImagePicker;
