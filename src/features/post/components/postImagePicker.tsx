import { X } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import {
  MAX_IMAGE_SOURCE_BYTES,
  toMegabyteText,
} from '../../../shared/utils/imageSizeLimit';
import { ALLOWED_POST_IMAGE_TYPES, MAX_POST_IMAGE_COUNT } from '../utils/validatePostInput';
import type { PostImageItem } from '../types';

type PostImagePickerProps = {
  images: PostImageItem[];
  errorMessage?: string;
  disabled?: boolean;
  onImagesChange(images: PostImageItem[]): void;
};

const INPUT_ID = 'postImages';
const ERROR_ID = 'postImages-error';

/**
 * 상품 사진 여러 장을 고른다. 첫 장이 목록 썸네일이 되므로 그 사실을 화면에 적어 둔다.
 *
 * 수정 화면에서는 이미 올라가 있는 사진과 방금 고른 사진이 한 줄에 섞인다.
 * 보여줄 주소를 만드는 방법만 다르고(공개 URL 그대로 / blob URL) 나머지는 같다.
 *
 * blob URL은 파일 목록이 바뀔 때마다 통째로 다시 만들고 이전 것을 해제한다.
 * 해제하지 않으면 사진을 여러 번 갈아 끼우는 동안 blob이 메모리에 계속 쌓인다.
 * 이미 올라간 사진의 URL은 우리가 만든 것이 아니므로 해제 대상이 아니다.
 */
function PostImagePicker(props: PostImagePickerProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const hasError = props.errorMessage !== undefined;
  const images = props.images;

  useEffect(
    function syncPreviewUrls() {
      const createdUrls: string[] = [];

      const urls = images.map(function toPreviewUrl(image: PostImageItem): string {
        if (image.kind === 'existing') {
          return image.url;
        }
        const objectUrl = URL.createObjectURL(image.file);
        createdUrls.push(objectUrl);
        return objectUrl;
      });

      setPreviewUrls(urls);

      return function revokePreviewUrls(): void {
        for (const url of createdUrls) {
          URL.revokeObjectURL(url);
        }
      };
    },
    [images],
  );

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const selected = Array.from(event.target.files ?? []);
    // 같은 파일을 다시 골라도 change가 일어나도록 입력값을 비운다.
    event.target.value = '';

    if (selected.length === 0) {
      return;
    }

    const added = selected.map(function toNewImage(file: File): PostImageItem {
      return { kind: 'new', file };
    });

    props.onImagesChange([...images, ...added]);
  }

  function handleRemove(index: number): void {
    props.onImagesChange(
      images.filter(function keepOthers(_image: PostImageItem, current: number): boolean {
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
            {images.length}/{MAX_POST_IMAGE_COUNT}
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
                <X size={14} />
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
        {/* 숫자를 손으로 적으면 상한이 바뀐 날 화면만 옛말을 한다 — 실제로 5MB인 채로 남아
            있었다. 고를 때의 상한을 그대로 읽는다(저장 상한은 줄인 뒤에 걸리므로 적지 않는다). */}
        최대 {MAX_POST_IMAGE_COUNT}장, 한 장에 {toMegabyteText(MAX_IMAGE_SOURCE_BYTES)}까지 올릴 수
        있어요. 첫 번째 사진이 목록에 보입니다.
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
