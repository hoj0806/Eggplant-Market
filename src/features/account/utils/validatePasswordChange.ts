import {
  validatePassword,
  validatePasswordConfirm,
} from '../../auth/utils/validateAuthInput';
import type { PasswordChangeFieldErrors, PasswordChangeValues } from '../types';

/**
 * 비밀번호 변경 입력 검사.
 *
 * 새 비밀번호에만 가입 때와 같은 규칙(validatePassword)을 건다.
 * **현재 비밀번호는 비었는지만 본다** — 규칙이 느슨하던 시절에 만든 비밀번호일 수 있고,
 * 여기서 막으면 정작 맞는 비밀번호를 들고도 바꿀 길이 없어진다. 맞는지 틀리는지는
 * 어차피 서버가 답한다.
 *
 * 같은 비밀번호는 미리 걸러낸다. 서버도 거절하지만(same_password) 그 왕복은
 * 화면이 알아볼 수 있는 것을 굳이 물어보는 셈이다.
 */
export function validatePasswordChangeValues(
  values: PasswordChangeValues,
): PasswordChangeFieldErrors {
  const errors: PasswordChangeFieldErrors = {};

  if (values.currentPassword.length === 0) {
    errors.currentPassword = '현재 비밀번호를 입력해 주세요.';
  }

  const newPasswordError = validatePassword(values.newPassword);
  if (newPasswordError !== undefined) {
    errors.newPassword = newPasswordError;
  } else if (values.newPassword === values.currentPassword) {
    errors.newPassword = '지금 쓰고 있는 비밀번호와 다른 비밀번호를 입력해 주세요.';
  }

  const confirmError = validatePasswordConfirm(
    values.newPassword,
    values.newPasswordConfirm,
  );
  if (confirmError !== undefined) {
    errors.newPasswordConfirm = confirmError;
  }

  return errors;
}

export function hasPasswordChangeError(errors: PasswordChangeFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
