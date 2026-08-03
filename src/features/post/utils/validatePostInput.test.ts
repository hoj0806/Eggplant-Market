import {
  hasPostFieldError,
  toNewImageFiles,
  validatePostCategory,
  validatePostDescription,
  validatePostFormValues,
  validatePostImages,
  validatePostPrice,
  validatePostTitle,
} from './validatePostInput';
import type { PostFormValues, PostImageItem } from '../types';

function makeFile(overrides: { type?: string; size?: number } = {}): File {
  const file = new File(['x'], 'photo.jpg', { type: overrides.type ?? 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: overrides.size ?? 1024 });
  return file;
}

function makeNewImage(overrides: { type?: string; size?: number } = {}): PostImageItem {
  return { kind: 'new', file: makeFile(overrides) };
}

function makeExistingImage(url = 'https://example.supabase.co/photo.jpg'): PostImageItem {
  return { kind: 'existing', url };
}

function makeValues(overrides: Partial<PostFormValues> = {}): PostFormValues {
  return {
    title: '아이패드 프로 11인치',
    description: '작년에 산 아이패드입니다. 생활기스 조금 있어요.',
    price: '450000',
    categoryId: 14,
    images: [makeNewImage()],
    tradePlace: null,
    ...overrides,
  };
}

describe('validatePostTitle', function titleSuite() {
  it('빈 제목을 막는다', function emptyCase() {
    expect(validatePostTitle('   ')).toBe('제목을 입력해 주세요.');
  });

  it('두 글자 미만을 막는다', function shortCase() {
    expect(validatePostTitle('책')).toBe('제목은 2자 이상이어야 합니다.');
  });

  it('40자를 넘으면 막는다', function longCase() {
    expect(validatePostTitle('가'.repeat(41))).toBe('제목은 40자 이하여야 합니다.');
  });

  it('알맞은 제목은 통과시킨다', function validCase() {
    expect(validatePostTitle('아이패드 팝니다')).toBeUndefined();
  });
});

describe('validatePostDescription', function descriptionSuite() {
  it('10자 미만을 막는다', function shortCase() {
    expect(validatePostDescription('싸게 팔아요')).toBe('상품 설명은 10자 이상이어야 합니다.');
  });

  it('2000자를 넘으면 막는다', function longCase() {
    expect(validatePostDescription('가'.repeat(2001))).toBe(
      '상품 설명은 2000자 이하여야 합니다.',
    );
  });
});

describe('validatePostPrice', function priceSuite() {
  it('0원(나눔)은 통과시킨다', function freeCase() {
    expect(validatePostPrice('0')).toBeUndefined();
  });

  it('빈 값을 막는다', function emptyCase() {
    expect(validatePostPrice('')).toBe('가격을 입력해 주세요. 무료로 나눔하려면 0원으로 두세요.');
  });

  it('숫자가 아닌 값을 막는다', function nonNumericCase() {
    expect(validatePostPrice('4만원')).toBe('가격은 숫자만 입력할 수 있습니다.');
    expect(validatePostPrice('-1000')).toBe('가격은 숫자만 입력할 수 있습니다.');
    expect(validatePostPrice('1,000')).toBe('가격은 숫자만 입력할 수 있습니다.');
  });

  it('integer 범위를 넘는 가격을 막는다', function overflowCase() {
    expect(validatePostPrice('1000000000')).toBe('가격은 999,999,999원 이하여야 합니다.');
  });
});

describe('validatePostCategory', function categorySuite() {
  it('소분류를 고르지 않으면 막는다', function emptyCase() {
    expect(validatePostCategory(null)).toBe('카테고리를 소분류까지 선택해 주세요.');
  });

  it('소분류를 고르면 통과시킨다', function validCase() {
    expect(validatePostCategory(14)).toBeUndefined();
  });
});

describe('validatePostImages', function imagesSuite() {
  it('사진이 없으면 막는다', function emptyCase() {
    expect(validatePostImages([])).toBe('상품 사진을 최소 1장 올려 주세요.');
  });

  it('11장부터 막는다', function tooManyCase() {
    const images = Array.from({ length: 11 }, function toImage() {
      return makeNewImage();
    });
    expect(validatePostImages(images)).toBe('사진은 최대 10장까지 올릴 수 있습니다.');
  });

  it('개수는 이미 올라간 사진까지 세어서 막는다', function mixedCountCase() {
    const images = [
      ...Array.from({ length: 6 }, function toExisting() {
        return makeExistingImage();
      }),
      ...Array.from({ length: 5 }, function toNew() {
        return makeNewImage();
      }),
    ];
    expect(validatePostImages(images)).toBe('사진은 최대 10장까지 올릴 수 있습니다.');
  });

  it('지원하지 않는 형식을 막는다', function wrongTypeCase() {
    expect(validatePostImages([makeNewImage({ type: 'application/pdf' })])).toBe(
      'JPG, PNG, WEBP, GIF 형식만 올릴 수 있습니다.',
    );
  });

  it('5MB를 넘는 사진을 막는다', function tooLargeCase() {
    expect(validatePostImages([makeNewImage({ size: 6 * 1024 * 1024 })])).toBe(
      '사진 한 장의 용량은 5MB 이하여야 합니다.',
    );
  });

  // 이미 올라간 사진은 등록할 때 같은 검사를 통과한 것들이라 파일을 다시 볼 방법이 없다.
  it('이미 올라간 사진만 남아 있어도 통과시킨다', function existingOnlyCase() {
    expect(validatePostImages([makeExistingImage()])).toBeUndefined();
  });
});

describe('toNewImageFiles', function newFilesSuite() {
  it('새로 고른 파일만 순서대로 골라낸다', function pickCase() {
    const first = makeFile();
    const second = makeFile();

    const files = toNewImageFiles([
      { kind: 'new', file: first },
      makeExistingImage(),
      { kind: 'new', file: second },
    ]);

    expect(files).toEqual([first, second]);
  });

  it('이미 올라간 사진뿐이면 올릴 것이 없다', function emptyCase() {
    expect(toNewImageFiles([makeExistingImage()])).toEqual([]);
  });
});

describe('validatePostFormValues', function formSuite() {
  it('올바른 값에는 오류가 없다', function validCase() {
    const errors = validatePostFormValues(makeValues());

    expect(hasPostFieldError(errors)).toBe(false);
  });

  it('여러 필드가 틀리면 모두 모아서 돌려준다', function multipleErrorsCase() {
    const errors = validatePostFormValues(
      makeValues({ title: '', price: '무료', categoryId: null, images: [] }),
    );

    expect(Object.keys(errors).sort()).toEqual(['categoryId', 'images', 'price', 'title']);
  });

  it('거래희망장소는 비어 있어도 통과시킨다', function optionalPlaceCase() {
    const errors = validatePostFormValues(makeValues({ tradePlace: null }));

    expect(hasPostFieldError(errors)).toBe(false);
  });
});
