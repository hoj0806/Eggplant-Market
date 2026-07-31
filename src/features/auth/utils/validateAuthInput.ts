import type { AuthFieldErrors, EmailCredentials, SignUpValues } from '../types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // Supabase(bcrypt) 상한

export function validateEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return '이메일을 입력해 주세요.';
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return '이메일 형식이 올바르지 않습니다.';
  }
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (password.length === 0) {
    return '비밀번호를 입력해 주세요.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `비밀번호는 ${MAX_PASSWORD_LENGTH}자 이하여야 합니다.`;
  }
  return undefined;
}

export function validatePasswordConfirm(
  password: string,
  passwordConfirm: string,
): string | undefined {
  if (passwordConfirm.length === 0) {
    return '비밀번호를 한 번 더 입력해 주세요.';
  }
  if (password !== passwordConfirm) {
    return '비밀번호가 일치하지 않습니다.';
  }
  return undefined;
}

export function validateSignInValues(values: EmailCredentials): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  const emailError = validateEmail(values.email);
  if (emailError !== undefined) {
    errors.email = emailError;
  }

  const passwordError = validatePassword(values.password);
  if (passwordError !== undefined) {
    errors.password = passwordError;
  }

  return errors;
}

export function validateSignUpValues(values: SignUpValues): AuthFieldErrors {
  const errors = validateSignInValues(values);

  const passwordConfirmError = validatePasswordConfirm(
    values.password,
    values.passwordConfirm,
  );
  if (passwordConfirmError !== undefined) {
    errors.passwordConfirm = passwordConfirmError;
  }

  return errors;
}

export function hasAuthFieldError(errors: AuthFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
