import { useState, type FormEvent } from 'react';
import AuthSubmitButton from './authSubmitButton';
import AuthTextField from './authTextField';
import type { AuthFieldErrors, EmailCredentials, SignUpValues } from '../types';
import { hasAuthFieldError, validateSignUpValues } from '../utils/validateAuthInput';

type SignUpFormProps = {
  isPending: boolean;
  onSubmit(credentials: EmailCredentials): void;
};

const EMPTY_SIGN_UP_VALUES: SignUpValues = {
  email: '',
  password: '',
  passwordConfirm: '',
};

function SignUpForm(props: SignUpFormProps) {
  const [values, setValues] = useState<SignUpValues>(EMPTY_SIGN_UP_VALUES);
  const [errors, setErrors] = useState<AuthFieldErrors>({});

  function updateField(field: keyof SignUpValues, value: string): void {
    setValues(function mergeField(previous) {
      return { ...previous, [field]: value };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextErrors = validateSignUpValues(values);
    setErrors(nextErrors);
    if (hasAuthFieldError(nextErrors)) {
      return;
    }

    props.onSubmit({ email: values.email.trim(), password: values.password });
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <AuthTextField
        id="email"
        label="이메일"
        type="email"
        value={values.email}
        autoComplete="email"
        placeholder="eggplant@example.com"
        errorMessage={errors.email}
        disabled={props.isPending}
        onValueChange={function handleEmailChange(value) {
          updateField('email', value);
        }}
      />
      <AuthTextField
        id="password"
        label="비밀번호"
        type="password"
        value={values.password}
        autoComplete="new-password"
        placeholder="8자 이상"
        errorMessage={errors.password}
        disabled={props.isPending}
        onValueChange={function handlePasswordChange(value) {
          updateField('password', value);
        }}
      />
      <AuthTextField
        id="passwordConfirm"
        label="비밀번호 확인"
        type="password"
        value={values.passwordConfirm}
        autoComplete="new-password"
        errorMessage={errors.passwordConfirm}
        disabled={props.isPending}
        onValueChange={function handlePasswordConfirmChange(value) {
          updateField('passwordConfirm', value);
        }}
      />
      <AuthSubmitButton label="회원가입" pendingLabel="가입 중…" isPending={props.isPending} />
    </form>
  );
}

export default SignUpForm;
