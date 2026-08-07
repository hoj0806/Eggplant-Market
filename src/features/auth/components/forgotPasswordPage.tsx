import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthFormMessage from './authFormMessage';
import AuthLayout from './authLayout';
import AuthSubmitButton from './authSubmitButton';
import AuthTextField from './authTextField';
import { usePasswordResetRequestMutation } from '../hooks/useAuthMutations';
import { toAuthErrorMessage } from '../utils/authErrorMessage';
import { validateEmail } from '../utils/validateAuthInput';

/**
 * **가입 여부를 알려 주지 않는 문구다.**
 *
 * "그런 이메일은 없습니다"를 내면 아무나 주소를 넣어 보며 **누가 이 서비스를 쓰는지**
 * 알아낼 수 있다. 중고거래는 사는 동네가 붙어 다니는 서비스라 그 노출이 가볍지 않다.
 * Supabase도 없는 주소에 성공으로 답하므로, 화면이 아는 것보다 더 말하지 않으면 된다.
 */
const SENT_NOTICE =
  '가입된 이메일이라면 재설정 링크를 보냈습니다. 메일함을 확인해 주세요. ' +
  '메일이 안 보이면 스팸함도 살펴봐 주세요.';

/** 로그인 화면의 "비밀번호를 잊으셨나요"가 오는 자리. */
function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const resetRequestMutation = usePasswordResetRequestMutation();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextError = validateEmail(email);
    setFieldError(nextError);
    if (nextError !== undefined) {
      return;
    }

    resetRequestMutation.mutate(email);
  }

  function handleEmailChange(value: string): void {
    setEmail(value);
    if (fieldError !== undefined) {
      setFieldError(validateEmail(value));
    }
  }

  const errorMessage =
    resetRequestMutation.error !== null
      ? toAuthErrorMessage(resetRequestMutation.error)
      : null;

  return (
    <AuthLayout
      title="비밀번호 재설정"
      description="가입할 때 쓴 이메일로 재설정 링크를 보내 드립니다."
      footer={
        <span>
          비밀번호가 기억나셨나요?{' '}
          <Link to="/login" className="font-semibold text-emerald-600 dark:text-emerald-400">
            로그인
          </Link>
        </span>
      }
    >
      {errorMessage !== null ? <AuthFormMessage tone="error" message={errorMessage} /> : null}
      {resetRequestMutation.isSuccess ? (
        <AuthFormMessage tone="info" message={SENT_NOTICE} />
      ) : null}

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthTextField
          id="email"
          label="이메일"
          type="email"
          value={email}
          autoComplete="email"
          placeholder="eggplant@example.com"
          errorMessage={fieldError}
          disabled={resetRequestMutation.isPending}
          onValueChange={handleEmailChange}
        />
        <AuthSubmitButton
          label="재설정 링크 받기"
          pendingLabel="보내는 중…"
          isPending={resetRequestMutation.isPending}
        />
      </form>
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
