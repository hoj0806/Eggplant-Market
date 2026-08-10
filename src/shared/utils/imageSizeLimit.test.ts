import {
  MAX_IMAGE_SOURCE_BYTES,
  findOversizedImage,
  toMegabyteText,
  validateSourceImageSize,
} from './imageSizeLimit';

function makeFile(size: number): File {
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('findOversizedImage', function oversizedSuite() {
  it('상한을 넘는 첫 파일을 준다', function firstOverCase() {
    const big = makeFile(100);

    expect(findOversizedImage([makeFile(10), big], 50)).toBe(big);
  });

  it('상한과 같으면 넘은 것이 아니다', function atLimitCase() {
    expect(findOversizedImage([makeFile(50)], 50)).toBeNull();
  });

  it('빈 목록은 null', function emptyCase() {
    expect(findOversizedImage([], 50)).toBeNull();
  });
});

describe('toMegabyteText', function megabyteSuite() {
  it('바이트를 MB 문구로 바꾼다', function convertCase() {
    expect(toMegabyteText(12 * 1024 * 1024)).toBe('12MB');
    expect(toMegabyteText(2 * 1024 * 1024)).toBe('2MB');
  });
});

describe('validateSourceImageSize', function sourceSuite() {
  it('원본 상한을 넘으면 문구를 준다', function overCase() {
    expect(validateSourceImageSize([makeFile(MAX_IMAGE_SOURCE_BYTES + 1)])).toBe(
      '사진 한 장의 용량은 12MB 이하여야 합니다.',
    );
  });

  it('정확히 상한이면 통과한다', function atLimitCase() {
    expect(validateSourceImageSize([makeFile(MAX_IMAGE_SOURCE_BYTES)])).toBeUndefined();
  });

  /**
   * 이 한 줄이 이번 작업의 요지다. 게시물·채팅·프로필 셋 다 버킷 상한(5·5·2MB)을
   * **원본**에 걸고 있어서, 줄이면 500kB가 될 폰 사진을 줄여 보지도 않고 거절했다.
   */
  it('버킷 상한을 넘는 원본도 고를 수 있다 — 줄인 뒤에 다시 잰다', function overBucketCase() {
    expect(validateSourceImageSize([makeFile(6 * 1024 * 1024)])).toBeUndefined();
  });
});
