import {
  hasPasswordChangeError,
  validatePasswordChangeValues,
} from './validatePasswordChange';
import type { PasswordChangeValues } from '../types';

function makeValues(overrides: Partial<PasswordChangeValues> = {}): PasswordChangeValues {
  return {
    currentPassword: 'eggplant1234',
    newPassword: 'eggplant5678',
    newPasswordConfirm: 'eggplant5678',
    ...overrides,
  };
}

describe('validatePasswordChangeValues', function validatePasswordChangeSuite() {
  it('올바른 입력이면 오류가 없다', function validCase() {
    const errors = validatePasswordChangeValues(makeValues());

    expect(hasPasswordChangeError(errors)).toBe(false);
  });

  it('현재 비밀번호가 비면 막는다', function emptyCurrentCase() {
    const errors = validatePasswordChangeValues(makeValues({ currentPassword: '' }));

    expect(errors.currentPassword).toBe('현재 비밀번호를 입력해 주세요.');
  });

  // 규칙이 느슨하던 시절의 비밀번호일 수 있다. 여기서 막으면 바꿀 길 자체가 없어진다.
  it('현재 비밀번호에는 길이 규칙을 걸지 않는다', function shortCurrentCase() {
    const errors = validatePasswordChangeValues(makeValues({ currentPassword: 'old' }));

    expect(errors.currentPassword).toBeUndefined();
  });

  it('새 비밀번호에는 가입 때와 같은 규칙을 건다', function weakNewCase() {
    const errors = validatePasswordChangeValues(
      makeValues({ newPassword: 'egg', newPasswordConfirm: 'egg' }),
    );

    expect(errors.newPassword).toBe('비밀번호는 8자 이상이어야 합니다.');
  });

  it('지금과 같은 비밀번호는 미리 걸러낸다', function samePasswordCase() {
    const errors = validatePasswordChangeValues(
      makeValues({ newPassword: 'eggplant1234', newPasswordConfirm: 'eggplant1234' }),
    );

    expect(errors.newPassword).toBe(
      '지금 쓰고 있는 비밀번호와 다른 비밀번호를 입력해 주세요.',
    );
  });

  it('확인 값이 다르면 막는다', function confirmMismatchCase() {
    const errors = validatePasswordChangeValues(
      makeValues({ newPasswordConfirm: 'eggplant9999' }),
    );

    expect(errors.newPasswordConfirm).toBe('비밀번호가 일치하지 않습니다.');
  });
});
