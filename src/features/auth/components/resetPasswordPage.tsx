import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthFormMessage from './authFormMessage';
import AuthLayout from './authLayout';
import AuthSubmitButton from './authSubmitButton';
import AuthTextField from './authTextField';
import { useNewPasswordMutation } from '../hooks/useAuthMutations';
import {
  selectAuthStatus,
  selectIsPasswordRecovery,
  useAuthStore,
} from '../store/authStore';
import type { AuthFieldErrors, NewPasswordValues } from '../types';
import { toAuthErrorMessage } from '../utils/authErrorMessage';
import { hasAuthFieldError, validateNewPasswordValues } from '../utils/validateAuthInput';

const EMPTY_VALUES: NewPasswordValues = { password: '', passwordConfirm: '' };

const EXPIRED_NOTICE =
  '링크가 만료되었거나 이미 사용되었습니다. 재설정 링크를 다시 받아 주세요.';

/**
 * 재설정 링크가 데려다주는 화면. 새 비밀번호만 정한다.
 *
 * **현재 비밀번호를 묻지 않는다.** 잊어버려서 온 사람에게 물어볼 수 없는 값이고, 본인이라는
 * 증명은 **메일함을 열었다는 사실**이 대신한다. 그래서 그 증명이 실제로 있었는지를 여기서
 * 확인한다 — `isPasswordRecovery`가 그것이다(`PASSWORD_RECOVERY` 사건으로 켜진다).
 *
 * **"로그인돼 있으면 통과"로 두면 안 된다.** 그러면 남이 열어 둔 브라우저로 이 주소만 치면
 * 비밀번호를 바꿔 계정을 가져갈 수 있다 — `accountApi.changePassword`가 바꾸기 전에 현재
 * 비밀번호로 다시 로그인하는 이유가 바로 그것이고, 그 자리를 여기서는 링크가 맡는다.
 *
 * 다만 **이 확인은 화면에만 있다.** 서버는 세션만 있으면 `updateUser`를 받아 준다.
 * 진짜 잠금은 Supabase의 "Secure password change"(최근 로그인 요구)이고, 그건 대시보드
 * 스위치라 코드가 켤 수 없다 — 배포 준비 목록에 함께 적어 두었다.
 *
 * 새로고침하면 표가 사라져 만료 안내가 뜬다(메모리에만 있다). 링크를 다시 받으면 되는 일이라
 * **잃는 쪽으로 틀리게** 두었다.
 */
function ResetPasswordPage() {
  const navigate = useNavigate();
  const status = useAuthStore(selectAuthStatus);
  const isPasswordRecovery = useAuthStore(selectIsPasswordRecovery);
  const [values, setValues] = useState<NewPasswordValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const newPasswordMutation = useNewPasswordMutation();

  function updateField(field: keyof NewPasswordValues, value: string): void {
    setValues(function mergeField(previous) {
      return { ...previous, [field]: value };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextErrors = validateNewPasswordValues(values);
    setErrors(nextErrors);
    if (hasAuthFieldError(nextErrors)) {
      return;
    }

    newPasswordMutation.mutate(values.password, {
      onSuccess: function goHome(): void {
        // 로그아웃시키지 않는다. 방금 본인임을 증명한 사람이라 다시 로그인을 시킬 이유가 없다.
        navigate('/', { replace: true });
      },
    });
  }

  // 세션이 서기 전에는 아직 아무것도 말할 수 없다. 여기서 만료 안내를 내면
  // 링크로 제대로 들어온 사람에게도 한 번 깜빡인다.
  if (status === 'loading') {
    return (
      <AuthLayout title="비밀번호 재설정" description="링크를 확인하는 중입니다…">
        <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
          잠시만 기다려 주세요.
        </p>
      </AuthLayout>
    );
  }

  if (!isPasswordRecovery) {
    return (
      <AuthLayout
        title="비밀번호 재설정"
        description="링크를 다시 확인해 주세요."
        footer={
          <span>
            <Link
              to="/forgot-password"
              className="font-semibold text-emerald-600 dark:text-emerald-400"
            >
              재설정 링크 다시 받기
            </Link>
          </span>
        }
      >
        <AuthFormMessage tone="error" message={EXPIRED_NOTICE} />
      </AuthLayout>
    );
  }

  const errorMessage =
    newPasswordMutation.error !== null
      ? toAuthErrorMessage(newPasswordMutation.error)
      : null;

  return (
    <AuthLayout title="새 비밀번호 설정" description="앞으로 쓸 비밀번호를 입력해 주세요.">
      {errorMessage !== null ? <AuthFormMessage tone="error" message={errorMessage} /> : null}

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthTextField
          id="password"
          label="새 비밀번호"
          type="password"
          value={values.password}
          autoComplete="new-password"
          placeholder="8자 이상"
          errorMessage={errors.password}
          disabled={newPasswordMutation.isPending}
          onValueChange={function handlePasswordChange(value) {
            updateField('password', value);
          }}
        />
        <AuthTextField
          id="passwordConfirm"
          label="새 비밀번호 확인"
          type="password"
          value={values.passwordConfirm}
          autoComplete="new-password"
          errorMessage={errors.passwordConfirm}
          disabled={newPasswordMutation.isPending}
          onValueChange={function handlePasswordConfirmChange(value) {
            updateField('passwordConfirm', value);
          }}
        />
        <AuthSubmitButton
          label="비밀번호 변경"
          pendingLabel="변경 중…"
          isPending={newPasswordMutation.isPending}
        />
      </form>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
