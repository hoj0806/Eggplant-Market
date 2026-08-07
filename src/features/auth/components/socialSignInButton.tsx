import type { SocialProvider } from '../types';

type SocialSignInButtonProps = {
  provider: SocialProvider;
  isPending: boolean;
  onClick(provider: SocialProvider): void;
};

/**
 * 프로바이더별로 다른 것만 모아 둔다. 버튼을 하나 더 만들 때 손댈 곳이 여기 한 군데다.
 *
 * 카카오 색은 브랜드 규정값이다(노랑 `#FEE500` + 검정 85% 글자). 구글은 흰 바탕에 테두리라
 * 다크 모드에서 갈라지지만, 카카오는 **어느 모드에서도 노랑 그대로**여야 한다 —
 * 그것이 그 버튼을 알아보게 하는 유일한 표시라 배경에 맞춰 바꾸면 못 알아본다.
 */
const BUTTON_STYLE: Record<SocialProvider, { label: string; className: string }> = {
  google: {
    label: '구글로 시작하기',
    className:
      'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 ' +
      'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800',
  },
  kakao: {
    label: '카카오로 시작하기',
    className: 'border border-transparent bg-[#FEE500] text-[#191600]/85 hover:brightness-95',
  },
};

const PENDING_LABEL: Record<SocialProvider, string> = {
  google: '구글로 이동 중…',
  kakao: '카카오로 이동 중…',
};

function GoogleLogoIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/** 카카오 말풍선. 노란 바탕 위에 얹히므로 한 가지 색으로 그린다. */
function KakaoLogoIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path
        fill="#191600"
        fillOpacity="0.85"
        d="M9 1.5C4.86 1.5 1.5 4.13 1.5 7.38c0 2.1 1.4 3.94 3.5 4.98l-.88 3.23c-.08.28.23.5.47.34l3.87-2.56c.18.01.36.02.54.02 4.14 0 7.5-2.63 7.5-5.88S13.14 1.5 9 1.5z"
      />
    </svg>
  );
}

function SocialSignInButton(props: SocialSignInButtonProps) {
  const style = BUTTON_STYLE[props.provider];

  function handleClick(): void {
    props.onClick(props.provider);
  }

  return (
    <button
      type="button"
      disabled={props.isPending}
      onClick={handleClick}
      className={
        'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm ' +
        'font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ' +
        style.className
      }
    >
      {props.provider === 'google' ? <GoogleLogoIcon /> : <KakaoLogoIcon />}
      {props.isPending ? PENDING_LABEL[props.provider] : style.label}
    </button>
  );
}

export default SocialSignInButton;
