import type { PostFieldErrors, PostFormValues } from '../types';

const MIN_TITLE_LENGTH = 2;
const MAX_TITLE_LENGTH = 40;
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 2000;

/** 10억 미만. posts.price가 integer라 int4 범위를 넘으면 안 된다. */
const MAX_PRICE = 999_999_999;

export const MAX_POST_IMAGE_COUNT = 10;
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;

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

/**
 * 중고거래에서 사진은 사실상 본문이라 최소 한 장을 받는다.
 * 용량·형식은 스토리지 버킷에서도 막지만, 업로드를 시작하기 전에 알려 주는 편이 낫다.
 */
export function validatePostImages(files: ReadonlyArray<File>): string | undefined {
  if (files.length === 0) {
    return '상품 사진을 최소 1장 올려 주세요.';
  }
  if (files.length > MAX_POST_IMAGE_COUNT) {
    return `사진은 최대 ${MAX_POST_IMAGE_COUNT}장까지 올릴 수 있습니다.`;
  }

  const hasWrongType = files.some(function isWrongType(file: File): boolean {
    return !ALLOWED_POST_IMAGE_TYPES.includes(file.type);
  });
  if (hasWrongType) {
    return 'JPG, PNG, WEBP, GIF 형식만 올릴 수 있습니다.';
  }

  const hasTooLarge = files.some(function isTooLarge(file: File): boolean {
    return file.size > MAX_POST_IMAGE_BYTES;
  });
  if (hasTooLarge) {
    return '사진 한 장의 용량은 5MB 이하여야 합니다.';
  }

  return undefined;
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

  const imagesError = validatePostImages(values.imageFiles);
  if (imagesError !== undefined) {
    errors.imageFiles = imagesError;
  }

  return errors;
}

export function hasPostFieldError(errors: PostFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
