type AuthFormMessageProps = {
  tone: 'error' | 'info';
  message: string;
};

const CLASS_BY_TONE: Record<AuthFormMessageProps['tone'], string> = {
  error:
    'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
  info:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

/** 폼 전체에 대한 서버 응답 메시지(로그인 실패, 가입 안내 등). */
function AuthFormMessage(props: AuthFormMessageProps) {
  return (
    <p
      role={props.tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2 text-sm ${CLASS_BY_TONE[props.tone]}`}
    >
      {props.message}
    </p>
  );
}

export default AuthFormMessage;
