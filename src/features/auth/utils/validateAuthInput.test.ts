import {
  hasAuthFieldError,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateSignInValues,
  validateSignUpValues,
} from './validateAuthInput';

describe('validateEmail', function validateEmailSuite() {
  it('빈 값이면 입력 안내를 반환한다', function emptyCase() {
    expect(validateEmail('   ')).toBe('이메일을 입력해 주세요.');
  });

  it('형식이 틀리면 오류를 반환한다', function invalidCase() {
    expect(validateEmail('eggplant.example.com')).toBe('이메일 형식이 올바르지 않습니다.');
    expect(validateEmail('eggplant@example')).toBe('이메일 형식이 올바르지 않습니다.');
  });

  it('앞뒤 공백은 무시하고 통과시킨다', function validCase() {
    expect(validateEmail('  eggplant@example.com  ')).toBeUndefined();
  });
});

describe('validatePassword', function validatePasswordSuite() {
  it('빈 값이면 입력 안내를 반환한다', function emptyCase() {
    expect(validatePassword('')).toBe('비밀번호를 입력해 주세요.');
  });

  it('8자 미만이면 오류를 반환한다', function tooShortCase() {
    expect(validatePassword('1234567')).toBe('비밀번호는 8자 이상이어야 합니다.');
  });

  it('72자를 넘으면 오류를 반환한다', function tooLongCase() {
    expect(validatePassword('a'.repeat(73))).toBe('비밀번호는 72자 이하여야 합니다.');
  });

  it('8자 이상 72자 이하면 통과한다', function validCase() {
    expect(validatePassword('eggplant1234')).toBeUndefined();
    expect(validatePassword('a'.repeat(72))).toBeUndefined();
  });
});

describe('validatePasswordConfirm', function validatePasswordConfirmSuite() {
  it('확인값이 비어 있으면 입력 안내를 반환한다', function emptyCase() {
    expect(validatePasswordConfirm('eggplant1234', '')).toBe('비밀번호를 한 번 더 입력해 주세요.');
  });

  it('두 값이 다르면 불일치 오류를 반환한다', function mismatchCase() {
    expect(validatePasswordConfirm('eggplant1234', 'eggplant4321')).toBe(
      '비밀번호가 일치하지 않습니다.',
    );
  });

  it('두 값이 같으면 통과한다', function matchCase() {
    expect(validatePasswordConfirm('eggplant1234', 'eggplant1234')).toBeUndefined();
  });
});

describe('validateSignInValues', function validateSignInValuesSuite() {
  it('올바른 입력이면 오류가 없다', function validCase() {
    const errors = validateSignInValues({
      email: 'eggplant@example.com',
      password: 'eggplant1234',
    });
    expect(hasAuthFieldError(errors)).toBe(false);
  });

  it('두 필드가 모두 잘못되면 각각 오류를 담는다', function invalidCase() {
    const errors = validateSignInValues({ email: 'nope', password: '123' });
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
    expect(hasAuthFieldError(errors)).toBe(true);
  });
});

describe('validateSignUpValues', function validateSignUpValuesSuite() {
  it('세 필드가 모두 올바르면 오류가 없다', function validCase() {
    const errors = validateSignUpValues({
      email: 'eggplant@example.com',
      password: 'eggplant1234',
      passwordConfirm: 'eggplant1234',
    });
    expect(hasAuthFieldError(errors)).toBe(false);
  });

  it('비밀번호 확인이 다르면 passwordConfirm 오류만 발생한다', function mismatchCase() {
    const errors = validateSignUpValues({
      email: 'eggplant@example.com',
      password: 'eggplant1234',
      passwordConfirm: 'eggplant4321',
    });
    expect(errors.email).toBeUndefined();
    expect(errors.password).toBeUndefined();
    expect(errors.passwordConfirm).toBe('비밀번호가 일치하지 않습니다.');
  });
});
