import { useState, type FormEvent } from 'react';
import AuthSubmitButton from './authSubmitButton';
import AuthTextField from './authTextField';
import type { AuthFieldErrors, EmailCredentials } from '../types';
import { hasAuthFieldError, validateSignInValues } from '../utils/validateAuthInput';

type SignInFormProps = {
  isPending: boolean;
  onSubmit(credentials: EmailCredentials): void;
};

const EMPTY_SIGN_IN_VALUES: EmailCredentials = {
  email: '',
  password: '',
};

function SignInForm(props: SignInFormProps) {
  const [values, setValues] = useState<EmailCredentials>(EMPTY_SIGN_IN_VALUES);
  const [errors, setErrors] = useState<AuthFieldErrors>({});

  function updateField(field: keyof EmailCredentials, value: string): void {
    setValues(function mergeField(previous) {
      return { ...previous, [field]: value };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextErrors = validateSignInValues(values);
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
        autoComplete="current-password"
        errorMessage={errors.password}
        disabled={props.isPending}
        onValueChange={function handlePasswordChange(value) {
          updateField('password', value);
        }}
      />
      <AuthSubmitButton label="로그인" pendingLabel="로그인 중…" isPending={props.isPending} />
    </form>
  );
}

export default SignInForm;
