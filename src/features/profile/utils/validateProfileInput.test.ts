import {
  ALLOWED_AVATAR_TYPES,
  MAX_AVATAR_BYTES,
  hasProfileFieldError,
  validateAvatarFile,
  validateNickname,
  validateProfileOnboardingValues,
} from './validateProfileInput';

function createFile(type: string, size: number): File {
  const file = new File(['x'], 'avatar.png', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validateNickname', function validateNicknameSuite() {
  it('빈 값이면 입력을 요구한다', function emptyCase() {
    expect(validateNickname('   ')).toBe('닉네임을 입력해 주세요.');
  });

  it('2자 미만이면 오류를 돌려준다', function tooShortCase() {
    expect(validateNickname('가')).toBe('닉네임은 2자 이상이어야 합니다.');
  });

  it('12자를 넘으면 오류를 돌려준다', function tooLongCase() {
    expect(validateNickname('a'.repeat(13))).toBe('닉네임은 12자 이하여야 합니다.');
  });

  it('허용하지 않는 문자가 있으면 오류를 돌려준다', function invalidCharacterCase() {
    expect(validateNickname('가지 마켓')).toBe(
      '닉네임은 한글, 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.',
    );
    expect(validateNickname('eggplant!')).toBe(
      '닉네임은 한글, 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.',
    );
  });

  it('트리거가 만드는 임시 닉네임(user_xxxxxxxx, 13자)은 길이 제한에 걸린다', function temporaryNicknameCase() {
    expect(validateNickname('user_b5fbc0ff')).toBe('닉네임은 12자 이하여야 합니다.');
  });

  it('한글·영문·숫자·밑줄 조합은 통과시킨다', function validCase() {
    expect(validateNickname('가지마켓')).toBeUndefined();
    expect(validateNickname('egg_plant2')).toBeUndefined();
    expect(validateNickname('  가지  ')).toBeUndefined();
  });
});

describe('validateAvatarFile', function validateAvatarFileSuite() {
  it('선택하지 않아도(null) 통과시킨다 — 기본 이미지를 쓰기 때문', function noFileCase() {
    expect(validateAvatarFile(null)).toBeUndefined();
  });

  it('허용하지 않는 형식이면 오류를 돌려준다', function invalidTypeCase() {
    expect(validateAvatarFile(createFile('application/pdf', 1000))).toBe(
      'JPG, PNG, WEBP, GIF 형식만 올릴 수 있습니다.',
    );
  });

  it('2MB를 넘으면 오류를 돌려준다', function tooLargeCase() {
    expect(validateAvatarFile(createFile('image/png', MAX_AVATAR_BYTES + 1))).toBe(
      '이미지 용량은 2MB 이하여야 합니다.',
    );
  });

  it('허용 형식이고 2MB 이하면 통과시킨다', function validFileCase() {
    for (const type of ALLOWED_AVATAR_TYPES) {
      expect(validateAvatarFile(createFile(type, MAX_AVATAR_BYTES))).toBeUndefined();
    }
  });
});

describe('validateProfileOnboardingValues', function onboardingValuesSuite() {
  it('닉네임만 올바르면 사진 없이도 오류가 없다', function nicknameOnlyCase() {
    const errors = validateProfileOnboardingValues({ nickname: '가지마켓', avatarFile: null });

    expect(hasProfileFieldError(errors)).toBe(false);
  });

  it('닉네임과 사진 오류를 함께 모은다', function bothInvalidCase() {
    const errors = validateProfileOnboardingValues({
      nickname: '',
      avatarFile: createFile('application/pdf', 10),
    });

    expect(errors.nickname).toBe('닉네임을 입력해 주세요.');
    expect(errors.avatarFile).toBe('JPG, PNG, WEBP, GIF 형식만 올릴 수 있습니다.');
    expect(hasProfileFieldError(errors)).toBe(true);
  });
});
