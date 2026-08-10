import { MAX_IMAGE_SOURCE_BYTES } from '../../../shared/utils/imageSizeLimit';
import {
  canSendMessageText,
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_IMAGE_COUNT,
  validateChatImages,
  validateMessageText,
  validateOfferAmount,
  validateUploadableChatImages,
} from './validateChatInput';

function toFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function toImage(size = 1024): File {
  return toFile('photo.jpg', 'image/jpeg', size);
}

describe('validateMessageText', function validateMessageTextSuite() {
  it('빈 문자열은 보낼 수 없다', function empty() {
    expect(validateMessageText('')).toBe('보낼 내용을 입력해 주세요.');
  });

  it('공백과 줄바꿈만 있어도 보낼 수 없다', function whitespaceOnly() {
    expect(validateMessageText('   \n\t ')).toBe('보낼 내용을 입력해 주세요.');
  });

  it('1000자까지는 보낼 수 있다', function atLimit() {
    expect(validateMessageText('가'.repeat(1000))).toBeUndefined();
  });

  it('1000자를 넘으면 막는다', function overLimit() {
    expect(validateMessageText('가'.repeat(1001))).toBe('메시지는 1000자 이하여야 합니다.');
  });
});

describe('canSendMessageText', function canSendMessageTextSuite() {
  it('내용이 있으면 보낼 수 있다', function hasText() {
    expect(canSendMessageText(' 안녕하세요 ')).toBe(true);
  });

  it('공백뿐이면 보낼 수 없다', function blank() {
    expect(canSendMessageText('  ')).toBe(false);
  });
});

describe('validateChatImages', function validateChatImagesSuite() {
  it('고른 사진이 없으면 막는다', function noFiles() {
    expect(validateChatImages([])).toBe('보낼 사진을 선택해 주세요.');
  });

  it('한 번에 보낼 수 있는 장수를 넘으면 막는다', function tooMany() {
    const files = Array.from({ length: MAX_CHAT_IMAGE_COUNT + 1 }, function make(): File {
      return toImage();
    });

    expect(validateChatImages(files)).toBe(
      `사진은 한 번에 ${MAX_CHAT_IMAGE_COUNT}장까지 보낼 수 있습니다.`,
    );
  });

  it('허용하지 않는 형식은 막는다', function wrongType() {
    expect(validateChatImages([toFile('doc.pdf', 'application/pdf', 1024)])).toBe(
      'JPG, PNG, WEBP, GIF 형식만 보낼 수 있습니다.',
    );
  });

  it('12MB를 넘는 사진은 막는다', function tooLarge() {
    expect(validateChatImages([toImage(MAX_IMAGE_SOURCE_BYTES + 1)])).toBe(
      '사진 한 장의 용량은 12MB 이하여야 합니다.',
    );
  });

  it('정확히 12MB는 통과한다', function atByteLimit() {
    expect(validateChatImages([toImage(MAX_IMAGE_SOURCE_BYTES)])).toBeUndefined();
  });

  it('버킷 상한(5MB)이 넘어도 고를 수는 있다 — 줄이면 작아지기 때문', function overStorageLimit() {
    // 게시물이 2026-08-09에 나눈 것과 같은 자리다. 채팅도 올리기 전에 줄이는데
    // 상한만 원본에 걸려 있어, 줄이면 500kB가 될 폰 사진을 거절하고 있었다.
    expect(validateChatImages([toImage(6 * 1024 * 1024)])).toBeUndefined();
  });
});

describe('validateUploadableChatImages', function uploadableSuite() {
  it('줄인 뒤에도 저장 상한을 넘으면 막는다', function overStorage() {
    expect(validateUploadableChatImages([toImage(MAX_CHAT_IMAGE_BYTES + 1)])).toBe(
      '줄여도 5MB를 넘는 사진이 있습니다. 더 작은 사진을 보내 주세요.',
    );
  });

  it('줄어들어 상한 아래면 통과한다', function shrunk() {
    expect(validateUploadableChatImages([toImage(483 * 1024)])).toBeUndefined();
  });

  it('정확히 저장 상한은 통과한다', function atStorageLimit() {
    expect(validateUploadableChatImages([toImage(MAX_CHAT_IMAGE_BYTES)])).toBeUndefined();
  });
});

describe('채팅 사진 상한 두 개의 관계', function limitRelationSuite() {
  it('고를 때의 상한이 저장 상한보다 크다', function sourceIsLooser() {
    expect(MAX_IMAGE_SOURCE_BYTES).toBeGreaterThan(MAX_CHAT_IMAGE_BYTES);
  });

  it('저장 상한은 버킷 설정과 같은 5MB다', function matchesBucket() {
    // supabase/migrations/0008_chat_and_trade_status.sql의 file_size_limit = 5242880.
    // 갈리면 클라이언트가 통과시킨 것을 서버가 거절한다.
    expect(MAX_CHAT_IMAGE_BYTES).toBe(5242880);
  });
});

describe('validateOfferAmount', function validateOfferAmountSuite() {
  it('금액을 비워 두면 막는다', function empty() {
    expect(validateOfferAmount('  ')).toBe('제안할 금액을 입력해 주세요.');
  });

  it('숫자가 아니면 막는다', function notANumber() {
    expect(validateOfferAmount('3만원')).toBe('금액은 숫자만 입력할 수 있습니다.');
  });

  it('천 단위 구분 기호도 숫자가 아니다', function grouped() {
    expect(validateOfferAmount('30,000')).toBe('금액은 숫자만 입력할 수 있습니다.');
  });

  it('음수는 막는다', function negative() {
    expect(validateOfferAmount('-1000')).toBe('금액은 숫자만 입력할 수 있습니다.');
  });

  it('0원은 제안이 아니다', function zero() {
    expect(validateOfferAmount('0')).toBe('1원 이상으로 제안해 주세요.');
  });

  it('int4를 넘는 금액은 막는다', function overLimit() {
    expect(validateOfferAmount('1000000000')).toBe('금액은 999,999,999원 이하여야 합니다.');
  });

  it('상한값 자체는 통과한다', function atLimit() {
    expect(validateOfferAmount('999999999')).toBeUndefined();
  });

  it('앞뒤 공백은 떼고 본다', function trimmed() {
    expect(validateOfferAmount(' 30000 ')).toBeUndefined();
  });
});
