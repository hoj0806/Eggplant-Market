import type { AuthUser } from '../../auth/types';

/**
 * 이 계정이 비밀번호로도 로그인하는가.
 *
 * 구글로만 가입한 사람에게는 바꿀 비밀번호가 없다. 그런 사람에게 폼을 보여 주면
 * "현재 비밀번호"에 무엇을 넣어도 통과하지 못하는 막다른 화면이 된다 — 그래서 감춘다.
 *
 * 판단은 `identities`를 먼저 본다. 한 계정에 로그인 방법이 여럿 붙을 수 있고
 * (같은 이메일로 구글을 이어 붙이면 identity가 둘이 된다) 그때 진짜 목록은 여기뿐이다.
 * `app_metadata.provider`는 **마지막으로 로그인한 방법 하나**라서, 이메일로 가입한 사람이
 * 구글로 한 번 들어오면 'google'로 바뀌어 비밀번호 변경이 사라져 버린다.
 * identities가 없는 응답(옛 세션·축약된 사용자)일 때만 app_metadata로 물러난다.
 */

const PASSWORD_PROVIDER = 'email';

type AuthAppMetadata = {
  provider?: string;
  providers?: string[];
};

export function hasPasswordLogin(user: AuthUser | null): boolean {
  if (user === null) {
    return false;
  }

  const identities = user.identities;
  if (identities !== undefined && identities !== null) {
    return identities.some(function isPasswordIdentity(identity): boolean {
      return identity.provider === PASSWORD_PROVIDER;
    });
  }

  const metadata = user.app_metadata as AuthAppMetadata | undefined;
  if (metadata === undefined) {
    return false;
  }
  if (Array.isArray(metadata.providers)) {
    return metadata.providers.includes(PASSWORD_PROVIDER);
  }

  return metadata.provider === PASSWORD_PROVIDER;
}
