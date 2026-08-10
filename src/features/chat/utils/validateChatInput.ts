import {
  findOversizedImage,
  toMegabyteText,
  validateSourceImageSize,
} from '../../../shared/utils/imageSizeLimit';

/** 한 번에 보낼 수 있는 글자 수. 대화라 게시물 본문만큼 길 이유가 없다. */
const MAX_MESSAGE_LENGTH = 1000;

export const MAX_CHAT_IMAGE_COUNT = 5;

/**
 * **저장 상한.** `chat-images` 버킷의 `file_size_limit`과 같은 값이어야 한다(0008).
 *
 * 이 값은 **줄인 뒤의 파일**에 걸린다. 고를 때의 상한은 원본에 걸리는 다른 값이다
 * (`MAX_IMAGE_SOURCE_BYTES`) — 왜 둘인지는 `shared/utils/imageSizeLimit`에 적었다.
 */
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

  // 원본 기준이다. 저장 상한(5MB)이 아니라 디코드가 감당할 크기를 본다 —
  // 줄이면 500kB가 될 폰 사진을 줄여 보지도 않고 거절하지 않으려는 것이다.
  return validateSourceImageSize(files);
}

/**
 * 줄인 뒤에도 저장 상한을 넘는 파일이 있는지. 업로드 직전에 재는 두 번째 상한이다.
 *
 * 줄이기는 실패해도 원본으로 물러난다(`downscaleImage`). 그래서 여기 걸리는 것은
 * **줄일 수 없었던 사진**이다 — GIF이거나, 이미 작은 크기인데 용량만 큰 경우다.
 * 여기서 안 세우면 버킷이 서버에서 거절해 이유를 알 수 없는 실패로 보인다.
 */
export function validateUploadableChatImages(
  files: ReadonlyArray<File>,
): string | undefined {
  if (findOversizedImage(files, MAX_CHAT_IMAGE_BYTES) === null) {
    return undefined;
  }

  return `줄여도 ${toMegabyteText(MAX_CHAT_IMAGE_BYTES)}를 넘는 사진이 있습니다. 더 작은 사진을 보내 주세요.`;
}

/** 전송 버튼을 열지 말지. 검증 문구를 띄우지 않고 그냥 잠글 때 쓴다. */
export function canSendMessageText(text: string): boolean {
  return validateMessageText(text) === undefined;
}

/** 게시물 가격과 같은 상한이다. messages.offer_amount도 integer라 int4를 넘으면 안 된다. */
const MAX_OFFER_AMOUNT = 999_999_999;

/**
 * 제안 금액. 입력 중이라 아직 문자열이다.
 *
 * 게시물 가격과 달리 0원을 받지 않는다. 나눔을 요청하는 것은 값을 부르는 일이 아니라
 * 말로 물어볼 일이고, 금액 0인 제안은 말풍선에 '나눔 제안'으로 떠 뜻이 흐려진다.
 */
export function validateOfferAmount(amount: string): string | undefined {
  const trimmed = amount.trim();

  if (trimmed.length === 0) {
    return '제안할 금액을 입력해 주세요.';
  }
  if (!/^\d+$/.test(trimmed)) {
    return '금액은 숫자만 입력할 수 있습니다.';
  }
  if (Number(trimmed) === 0) {
    return '1원 이상으로 제안해 주세요.';
  }
  if (Number(trimmed) > MAX_OFFER_AMOUNT) {
    return `금액은 ${MAX_OFFER_AMOUNT.toLocaleString('ko-KR')}원 이하여야 합니다.`;
  }

  return undefined;
}
