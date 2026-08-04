import {
  canSendMessageText,
  MAX_CHAT_IMAGE_COUNT,
  validateChatImages,
  validateMessageText,
  validateOfferAmount,
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

  it('5MB를 넘는 사진은 막는다', function tooLarge() {
    expect(validateChatImages([toImage(5 * 1024 * 1024 + 1)])).toBe(
      '사진 한 장의 용량은 5MB 이하여야 합니다.',
    );
  });

  it('정확히 5MB는 통과한다', function atByteLimit() {
    expect(validateChatImages([toImage(5 * 1024 * 1024)])).toBeUndefined();
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
