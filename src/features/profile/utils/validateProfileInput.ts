import {
  findOversizedImage,
  toMegabyteText,
  validateSourceImageSize,
} from '../../../shared/utils/imageSizeLimit';
import type { Region } from '../../region/types';
import type { ProfileFieldErrors, ProfileOnboardingValues } from '../types';

const MIN_NICKNAME_LENGTH = 2;
const MAX_NICKNAME_LENGTH = 12;
const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]+$/;

/**
 * **저장 상한.** `avatars` 버킷의 `file_size_limit`과 같은 값이어야 한다(0002).
 *
 * 셋 중 가장 작다 — 프로필 사진은 화면에서 가장 커야 40px 남짓이라 더 클 이유가 없다.
 * 이 값은 **줄인 뒤의 파일**에 걸린다. 고를 때는 원본에 `MAX_IMAGE_SOURCE_BYTES`가 걸린다.
 */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export const ALLOWED_AVATAR_TYPES: ReadonlyArray<string> = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export function validateNickname(nickname: string): string | undefined {
  const trimmed = nickname.trim();

  if (trimmed.length === 0) {
    return '닉네임을 입력해 주세요.';
  }
  if (trimmed.length < MIN_NICKNAME_LENGTH) {
    return `닉네임은 ${MIN_NICKNAME_LENGTH}자 이상이어야 합니다.`;
  }
  if (trimmed.length > MAX_NICKNAME_LENGTH) {
    return `닉네임은 ${MAX_NICKNAME_LENGTH}자 이하여야 합니다.`;
  }
  if (!NICKNAME_PATTERN.test(trimmed)) {
    return '닉네임은 한글, 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.';
  }

  return undefined;
}

/** 프로필 사진은 선택 사항이므로 null은 통과시킨다(기본 이미지 사용). */
export function validateAvatarFile(file: File | null): string | undefined {
  if (file === null) {
    return undefined;
  }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return 'JPG, PNG, WEBP, GIF 형식만 올릴 수 있습니다.';
  }

  // 원본 기준이다. 폰 셀피는 2MB를 넘기 일쑤인데 줄이면 대개 500kB도 안 된다 —
  // 저장 상한(2MB)은 줄인 뒤에 `validateUploadableAvatar`가 잰다.
  return validateSourceImageSize([file]);
}

/**
 * 줄인 뒤에도 저장 상한을 넘는지. 업로드 직전에 재는 두 번째 상한이다.
 *
 * 줄이기가 실패하면 원본이 그대로 온다(`downscaleImage`). 여기 걸리는 것은
 * **줄일 수 없었던 사진**이다 — GIF이거나, 이미 작은 크기인데 용량만 큰 경우다.
 */
export function validateUploadableAvatar(file: File): string | undefined {
  if (findOversizedImage([file], MAX_AVATAR_BYTES) === null) {
    return undefined;
  }

  return `줄여도 ${toMegabyteText(MAX_AVATAR_BYTES)}를 넘습니다. 더 작은 사진을 올려 주세요.`;
}

export function validateProfileOnboardingValues(
  values: ProfileOnboardingValues,
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  const nicknameError = validateNickname(values.nickname);
  if (nicknameError !== undefined) {
    errors.nickname = nicknameError;
  }

  const avatarError = validateAvatarFile(values.avatarFile);
  if (avatarError !== undefined) {
    errors.avatarFile = avatarError;
  }

  return errors;
}

export function hasProfileFieldError(errors: ProfileFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** 동네는 온보딩 2단계의 유일한 입력이라 필드 오류 맵 대신 문구 하나로 충분하다. */
export function validateRegion(region: Region | null): string | undefined {
  if (region === null) {
    return '동네를 선택해 주세요.';
  }

  return undefined;
}
