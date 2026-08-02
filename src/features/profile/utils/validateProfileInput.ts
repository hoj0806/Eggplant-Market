import type { Region } from '../../region/types';
import type { ProfileFieldErrors, ProfileOnboardingValues } from '../types';

const MIN_NICKNAME_LENGTH = 2;
const MAX_NICKNAME_LENGTH = 12;
const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]+$/;

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
  if (file.size > MAX_AVATAR_BYTES) {
    return '이미지 용량은 2MB 이하여야 합니다.';
  }

  return undefined;
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
