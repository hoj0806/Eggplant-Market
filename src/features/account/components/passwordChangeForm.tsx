import { useState, type FormEvent } from 'react';
import AuthTextField from '../../auth/components/authTextField';
import SubmitButton from '../../../shared/ui/submitButton';
import {
  hasPasswordChangeError,
  validatePasswordChangeValues,
} from '../utils/validatePasswordChange';
import type { PasswordChangeFieldErrors, PasswordChangeValues } from '../types';

type PasswordChangeFormProps = {
  isPending: boolean;
  onSubmit(values: PasswordChangeValues): void;
};

const EMPTY_VALUES: PasswordChangeValues = {
  currentPassword: '',
  newPassword: '',
  newPasswordConfirm: '',
};

/**
 * 비밀번호 변경 폼 — 값만 다룬다. 부르는 쪽(accountSettingsPage)이 계정을 안다.
 *
 * 입력이 로그인 폼과 같은 모양이라 인증 폼의 AuthTextField를 그대로 쓴다.
 * autoComplete는 브라우저 비밀번호 관리자가 알아듣는 이름이어야 한다 —
 * 현재 것은 current-password, 새 것 둘은 new-password다. 셋 다 new-password로 두면
 * 관리자가 옛 비밀번호를 새 칸에 채워 넣는다.
 */
function PasswordChangeForm(props: PasswordChangeFormProps) {
  const [values, setValues] = useState<PasswordChangeValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<PasswordChangeFieldErrors>({});

  function updateField(field: keyof PasswordChangeValues, value: string): void {
    setValues(function mergeField(previous) {
      return { ...previous, [field]: value };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextErrors = validatePasswordChangeValues(values);
    setErrors(nextErrors);
    if (hasPasswordChangeError(nextErrors)) {
      return;
    }

    props.onSubmit(values);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <AuthTextField
        id="currentPassword"
        label="현재 비밀번호"
        type="password"
        value={values.currentPassword}
        autoComplete="current-password"
        errorMessage={errors.currentPassword}
        disabled={props.isPending}
        onValueChange={function changeCurrentPassword(value: string): void {
          updateField('currentPassword', value);
        }}
      />

      <AuthTextField
        id="newPassword"
        label="새 비밀번호"
        type="password"
        value={values.newPassword}
        autoComplete="new-password"
        placeholder="8자 이상"
        errorMessage={errors.newPassword}
        disabled={props.isPending}
        onValueChange={function changeNewPassword(value: string): void {
          updateField('newPassword', value);
        }}
      />

      <AuthTextField
        id="newPasswordConfirm"
        label="새 비밀번호 확인"
        type="password"
        value={values.newPasswordConfirm}
        autoComplete="new-password"
        errorMessage={errors.newPasswordConfirm}
        disabled={props.isPending}
        onValueChange={function changeNewPasswordConfirm(value: string): void {
          updateField('newPasswordConfirm', value);
        }}
      />

      <SubmitButton
        label="비밀번호 변경"
        pendingLabel="변경 중…"
        isPending={props.isPending}
      />
    </form>
  );
}

export default PasswordChangeForm;
