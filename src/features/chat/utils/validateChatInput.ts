/** 한 번에 보낼 수 있는 글자 수. 대화라 게시물 본문만큼 길 이유가 없다. */
const MAX_MESSAGE_LENGTH = 1000;

export const MAX_CHAT_IMAGE_COUNT = 5;
export const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_CHAT_IMAGE_TYPES: ReadonlyArray<string> = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/**
 * 공백만 있는 메시지는 보내지 않는다.
 * 화면에서는 이 판정으로 전송 버튼을 잠그므로 문구가 뜨는 일은 드물다.
 */
export function validateMessageText(text: string): string | undefined {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return '보낼 내용을 입력해 주세요.';
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return `메시지는 ${MAX_MESSAGE_LENGTH}자 이하여야 합니다.`;
  }

  return undefined;
}

/**
 * 사진은 한 장이 메시지 한 건이라 장수를 게시물(10장)보다 적게 잡는다.
 * 용량·형식은 chat-images 버킷에서도 막지만, 업로드를 시작하기 전에 알려 주는 편이 낫다.
 */
export function validateChatImages(files: ReadonlyArray<File>): string | undefined {
  if (files.length === 0) {
    return '보낼 사진을 선택해 주세요.';
  }
  if (files.length > MAX_CHAT_IMAGE_COUNT) {
    return `사진은 한 번에 ${MAX_CHAT_IMAGE_COUNT}장까지 보낼 수 있습니다.`;
  }

  const hasWrongType = files.some(function isWrongType(file: File): boolean {
    return !ALLOWED_CHAT_IMAGE_TYPES.includes(file.type);
  });
  if (hasWrongType) {
    return 'JPG, PNG, WEBP, GIF 형식만 보낼 수 있습니다.';
  }

  const hasTooLarge = files.some(function isTooLarge(file: File): boolean {
    return file.size > MAX_CHAT_IMAGE_BYTES;
  });
  if (hasTooLarge) {
    return '사진 한 장의 용량은 5MB 이하여야 합니다.';
  }

  return undefined;
}

/** 전송 버튼을 열지 말지. 검증 문구를 띄우지 않고 그냥 잠글 때 쓴다. */
export function canSendMessageText(text: string): boolean {
  return validateMessageText(text) === undefined;
}
