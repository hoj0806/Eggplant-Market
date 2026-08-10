import { MAX_IMAGE_SOURCE_BYTES } from '../../../shared/utils/imageSizeLimit';
import {
  MAX_POST_IMAGE_BYTES,
  hasPostFieldError,
  toNewImageFiles,
  validatePostCategory,
  validatePostDescription,
  validatePostFormValues,
  validatePostImages,
  validatePostPrice,
  validateUploadableImages,
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

  it('12MB를 넘는 사진을 막는다', function tooLargeCase() {
    expect(validatePostImages([makeNewImage({ size: 13 * 1024 * 1024 })])).toBe(
      '사진 한 장의 용량은 12MB 이하여야 합니다.',
    );
  });

  it('5MB가 넘어도 고를 수는 있다 — 줄이면 작아지기 때문', function overStorageLimitCase() {
    // 2026-08-09 이전에는 여기서 막혔다. 4MB 사진이 483kB가 되는데도
    // **줄여 보지도 않고** 거절하고 있었다. 줄인 뒤의 상한은 업로드 직전에 다시 잰다.
    expect(validatePostImages([makeNewImage({ size: 6 * 1024 * 1024 })])).toBeUndefined();
  });

  it('정확히 12MB는 통과한다', function atSourceLimitCase() {
    expect(
      validatePostImages([makeNewImage({ size: MAX_IMAGE_SOURCE_BYTES })]),
    ).toBeUndefined();
  });

  // 이미 올라간 사진은 등록할 때 같은 검사를 통과한 것들이라 파일을 다시 볼 방법이 없다.
  it('이미 올라간 사진만 남아 있어도 통과시킨다', function existingOnlyCase() {
    expect(validatePostImages([makeExistingImage()])).toBeUndefined();
  });
});

// findOversizedImage는 셋이 나눠 쓰게 되면서 shared/utils/imageSizeLimit로 올라갔다.
// 재는 방법 자체의 테스트도 그쪽에 있다.

describe('validateUploadableImages', function uploadableSuite() {
  /**
   * 줄인 **뒤에** 재는 검사다. 여기 걸리는 것은 줄일 수 없었던 사진이다 —
   * GIF(캔버스에 그리면 움직임이 사라져 손대지 않는다)이거나,
   * 이미 1600px 이하인데 용량만 큰 경우다.
   */
  it('줄인 뒤에도 저장 상한을 넘으면 막는다', function overStorageCase() {
    expect(validateUploadableImages([makeFile({ size: MAX_POST_IMAGE_BYTES + 1 })])).toBe(
      '줄여도 5MB를 넘는 사진이 있습니다. 더 작은 사진을 올려 주세요.',
    );
  });

  it('줄어들어 상한 아래면 통과한다', function shrunkCase() {
    // 원본 6MB가 483kB가 되는 흔한 경우. 고를 때 막지 않은 것이 여기서 값을 한다.
    expect(validateUploadableImages([makeFile({ size: 483 * 1024 })])).toBeUndefined();
  });

  it('정확히 저장 상한은 통과한다', function atStorageLimitCase() {
    // 버킷의 file_size_limit과 같은 값이라, 여기서 통과한 것은 서버도 받는다.
    expect(
      validateUploadableImages([makeFile({ size: MAX_POST_IMAGE_BYTES })]),
    ).toBeUndefined();
  });
});

describe('상한 두 개의 관계', function limitRelationSuite() {
  it('고를 때의 상한이 저장 상한보다 크다', function sourceIsLooser() {
    // 이 순서가 뒤집히면 "고를 수는 있는데 무조건 업로드가 막히는" 구간이 생긴다.
    expect(MAX_IMAGE_SOURCE_BYTES).toBeGreaterThan(MAX_POST_IMAGE_BYTES);
  });

  it('저장 상한은 버킷 설정과 같은 5MB다', function matchesBucket() {
    // supabase/migrations/0005_post_create.sql의 file_size_limit = 5242880.
    // 갈리면 클라이언트가 통과시킨 것을 서버가 거절한다.
    expect(MAX_POST_IMAGE_BYTES).toBe(5242880);
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
