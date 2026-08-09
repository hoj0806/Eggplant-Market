import type { PostFieldErrors, PostFormValues, PostImageItem } from '../types';

const MIN_TITLE_LENGTH = 2;
const MAX_TITLE_LENGTH = 40;
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 2000;

/** 10억 미만. posts.price가 integer라 int4 범위를 넘으면 안 된다. */
const MAX_PRICE = 999_999_999;

export const MAX_POST_IMAGE_COUNT = 10;

/**
 * **저장 상한.** `post-images` 버킷의 `file_size_limit`과 같은 값이어야 한다(0005).
 *
 * 이 값은 **줄인 뒤의 파일**에 걸린다. 버킷이 서버에서 같은 값으로 막고 있으므로
 * 여기만 올려도 소용이 없다 — 업로드가 서버에서 거절될 뿐이다.
 */
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * **고르는 순간의 상한.** 원본에 걸린다.
 *
 * 2026-08-09에 5MB → 12MB로 올렸다. 이제 **올리기 전에 줄이기 때문이다**
 * (4MB → 483kB 실측). 고화소 폰 사진은 원본이 5MB를 넘는 일이 흔한데, 줄이면 500kB도
 * 안 되는 것을 **줄여 보지도 않고 거절**하고 있었다.
 *
 * 그래도 상한을 두는 이유는 메모리다. 디코드는 픽셀을 통째로 펼치므로
 * (8000×6000이면 RGBA 192MB) 낮은 사양 기기에서 탭이 죽을 수 있다.
 * 12MB는 48MP 폰 사진까지 감당하는 선이다.
 *
 * **상한을 올려도 저장 용량의 최악은 안 커진다** — 줄인 뒤 `MAX_POST_IMAGE_BYTES`를
 * 다시 재기 때문이다(`findOversizedImage`). 계획 ⑦이 걱정한 자리가 여기다.
 */
export const MAX_POST_IMAGE_SOURCE_BYTES = 12 * 1024 * 1024;

function toMegabyteText(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

/**
 * 상한을 넘는 첫 파일. 없으면 null.
 *
 * 고르는 순간(원본)과 줄인 뒤(업로드 직전) **두 곳이 같은 함수를 쓴다.** 두 곳이
 * 각자 재면 한쪽만 고쳐지는 날이 온다.
 */
export function findOversizedImage(
  files: ReadonlyArray<File>,
  limitBytes: number,
): File | null {
  return (
    files.find(function isTooLarge(file: File): boolean {
      return file.size > limitBytes;
    }) ?? null
  );
}

export const ALLOWED_POST_IMAGE_TYPES: ReadonlyArray<string> = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export function validatePostTitle(title: string): string | undefined {
  const trimmed = title.trim();

  if (trimmed.length === 0) {
    return '제목을 입력해 주세요.';
  }
  if (trimmed.length < MIN_TITLE_LENGTH) {
    return `제목은 ${MIN_TITLE_LENGTH}자 이상이어야 합니다.`;
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return `제목은 ${MAX_TITLE_LENGTH}자 이하여야 합니다.`;
  }

  return undefined;
}

export function validatePostDescription(description: string): string | undefined {
  const trimmed = description.trim();

  if (trimmed.length === 0) {
    return '상품 설명을 입력해 주세요.';
  }
  if (trimmed.length < MIN_DESCRIPTION_LENGTH) {
    return `상품 설명은 ${MIN_DESCRIPTION_LENGTH}자 이상이어야 합니다.`;
  }
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    return `상품 설명은 ${MAX_DESCRIPTION_LENGTH}자 이하여야 합니다.`;
  }

  return undefined;
}

/**
 * 가격은 화면에서 문자열로 다룬다. 0원은 나눔이라 정상값이다.
 * 소수점·음수·천 단위 구분 기호가 섞여 들어오는 것을 여기서 막는다.
 */
export function validatePostPrice(price: string): string | undefined {
  const trimmed = price.trim();

  if (trimmed.length === 0) {
    return '가격을 입력해 주세요. 무료로 나눔하려면 0원으로 두세요.';
  }
  if (!/^\d+$/.test(trimmed)) {
    return '가격은 숫자만 입력할 수 있습니다.';
  }
  if (Number(trimmed) > MAX_PRICE) {
    return `가격은 ${MAX_PRICE.toLocaleString('ko-KR')}원 이하여야 합니다.`;
  }

  return undefined;
}

/** 게시물은 언제나 소분류에 붙는다. 대분류만 고른 상태는 통과시키지 않는다. */
export function validatePostCategory(categoryId: number | null): string | undefined {
  if (categoryId === null) {
    return '카테고리를 소분류까지 선택해 주세요.';
  }

  return undefined;
}

/** 폼에 담긴 사진 중 이번에 새로 올릴 것만 고른다. */
export function toNewImageFiles(images: ReadonlyArray<PostImageItem>): File[] {
  const files: File[] = [];

  for (const image of images) {
    if (image.kind === 'new') {
      files.push(image.file);
    }
  }

  return files;
}

/**
 * 중고거래에서 사진은 사실상 본문이라 최소 한 장을 받는다.
 * 용량·형식은 스토리지 버킷에서도 막지만, 업로드를 시작하기 전에 알려 주는 편이 낫다.
 *
 * 개수는 전체로 세고, 용량·형식은 이번에 올릴 파일만 본다.
 * 이미 올라가 있는 사진은 등록할 때 같은 검사를 통과한 것들이라 다시 볼 방법도, 볼 이유도 없다.
 */
export function validatePostImages(images: ReadonlyArray<PostImageItem>): string | undefined {
  if (images.length === 0) {
    return '상품 사진을 최소 1장 올려 주세요.';
  }
  if (images.length > MAX_POST_IMAGE_COUNT) {
    return `사진은 최대 ${MAX_POST_IMAGE_COUNT}장까지 올릴 수 있습니다.`;
  }

  const files = toNewImageFiles(images);

  const hasWrongType = files.some(function isWrongType(file: File): boolean {
    return !ALLOWED_POST_IMAGE_TYPES.includes(file.type);
  });
  if (hasWrongType) {
    return 'JPG, PNG, WEBP, GIF 형식만 올릴 수 있습니다.';
  }

  // 원본 기준이다. 이보다 작아도 **줄인 뒤** 저장 상한을 넘으면 업로드 직전에 걸린다
  // (GIF처럼 줄일 수 없는 것). 여기서는 디코드조차 시도하지 않을 크기만 막는다.
  if (findOversizedImage(files, MAX_POST_IMAGE_SOURCE_BYTES) !== null) {
    return `사진 한 장의 용량은 ${toMegabyteText(MAX_POST_IMAGE_SOURCE_BYTES)} 이하여야 합니다.`;
  }

  return undefined;
}

/** 업로드가 줄인 뒤에도 저장 상한을 넘는 파일이 있는지. 넘으면 그 이유를 문구로 준다. */
export function validateUploadableImages(files: ReadonlyArray<File>): string | undefined {
  if (findOversizedImage(files, MAX_POST_IMAGE_BYTES) === null) {
    return undefined;
  }

  // 줄이기는 실패해도 원본으로 물러난다(downscaleImage). 그래서 여기 걸리는 것은
  // **줄일 수 없었던 사진**이다 — GIF이거나, 이미 작은 크기인데 용량만 큰 경우다.
  return `줄여도 ${toMegabyteText(MAX_POST_IMAGE_BYTES)}를 넘는 사진이 있습니다. 더 작은 사진을 올려 주세요.`;
}

export function validatePostFormValues(values: PostFormValues): PostFieldErrors {
  const errors: PostFieldErrors = {};

  const titleError = validatePostTitle(values.title);
  if (titleError !== undefined) {
    errors.title = titleError;
  }

  const descriptionError = validatePostDescription(values.description);
  if (descriptionError !== undefined) {
    errors.description = descriptionError;
  }

  const priceError = validatePostPrice(values.price);
  if (priceError !== undefined) {
    errors.price = priceError;
  }

  const categoryError = validatePostCategory(values.categoryId);
  if (categoryError !== undefined) {
    errors.categoryId = categoryError;
  }

  const imagesError = validatePostImages(values.images);
  if (imagesError !== undefined) {
    errors.images = imagesError;
  }

  return errors;
}

export function hasPostFieldError(errors: PostFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
