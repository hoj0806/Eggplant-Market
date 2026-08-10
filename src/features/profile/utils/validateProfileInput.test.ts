import { MAX_IMAGE_SOURCE_BYTES } from '../../../shared/utils/imageSizeLimit';
import {
  ALLOWED_AVATAR_TYPES,
  MAX_AVATAR_BYTES,
  hasProfileFieldError,
  validateAvatarFile,
  validateNickname,
  validateProfileOnboardingValues,
  validateRegion,
  validateUploadableAvatar,
} from './validateProfileInput';
import type { Region } from '../../region/types';

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

  it('12MB를 넘으면 오류를 돌려준다', function tooLargeCase() {
    expect(validateAvatarFile(createFile('image/png', MAX_IMAGE_SOURCE_BYTES + 1))).toBe(
      '사진 한 장의 용량은 12MB 이하여야 합니다.',
    );
  });

  it('허용 형식이고 12MB 이하면 통과시킨다', function validFileCase() {
    for (const type of ALLOWED_AVATAR_TYPES) {
      expect(validateAvatarFile(createFile(type, MAX_IMAGE_SOURCE_BYTES))).toBeUndefined();
    }
  });

  it('버킷 상한(2MB)이 넘어도 고를 수는 있다 — 줄이면 작아지기 때문', function overStorageLimitCase() {
    // 폰 셀피는 2MB를 넘기 일쑤다. 줄이면 대개 500kB도 안 되는데 줄여 보지도 않고
    // 거절하고 있었다. 저장 상한은 uploadAvatar가 줄인 뒤에 다시 잰다.
    expect(validateAvatarFile(createFile('image/jpeg', 4 * 1024 * 1024))).toBeUndefined();
  });
});

describe('validateUploadableAvatar', function uploadableAvatarSuite() {
  it('줄인 뒤에도 저장 상한을 넘으면 막는다', function overStorageCase() {
    expect(validateUploadableAvatar(createFile('image/gif', MAX_AVATAR_BYTES + 1))).toBe(
      '줄여도 2MB를 넘습니다. 더 작은 사진을 올려 주세요.',
    );
  });

  it('줄어들어 상한 아래면 통과한다', function shrunkCase() {
    expect(validateUploadableAvatar(createFile('image/jpeg', 300 * 1024))).toBeUndefined();
  });

  it('정확히 저장 상한은 통과한다', function atStorageLimitCase() {
    expect(validateUploadableAvatar(createFile('image/jpeg', MAX_AVATAR_BYTES))).toBeUndefined();
  });
});

describe('프로필 사진 상한 두 개의 관계', function limitRelationSuite() {
  it('고를 때의 상한이 저장 상한보다 크다', function sourceIsLooser() {
    expect(MAX_IMAGE_SOURCE_BYTES).toBeGreaterThan(MAX_AVATAR_BYTES);
  });

  it('저장 상한은 버킷 설정과 같은 2MB다', function matchesBucket() {
    // supabase/migrations/0002_profile_onboarding.sql의 file_size_limit = 2097152.
    expect(MAX_AVATAR_BYTES).toBe(2097152);
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

describe('validateRegion', function validateRegionSuite() {
  const REGION: Region = {
    code: '1130510300',
    depth1: '서울특별시',
    depth2: '강북구',
    depth3: '수유동',
    fullName: '서울특별시 강북구 수유동',
    coords: { lat: 37.6379, lng: 127.0146 },
  };

  it('동네를 고르지 않으면 오류다', function missingRegionCase() {
    expect(validateRegion(null)).toBe('동네를 선택해 주세요.');
  });

  it('동네를 골랐으면 통과한다', function selectedRegionCase() {
    expect(validateRegion(REGION)).toBeUndefined();
  });
});
