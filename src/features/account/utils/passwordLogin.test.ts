import { hasPasswordLogin } from './passwordLogin';
import type { AuthUser } from '../../auth/types';

type UserShape = {
  identities?: Array<{ provider: string }> | null;
  app_metadata?: { provider?: string; providers?: string[] };
};

function makeUser(shape: UserShape): AuthUser {
  return { id: 'user-1', ...shape } as unknown as AuthUser;
}

describe('hasPasswordLogin', function passwordLoginSuite() {
  it('이메일 identity가 있으면 비밀번호 로그인이다', function emailIdentityCase() {
    const user = makeUser({
      identities: [{ provider: 'email' }],
      app_metadata: { provider: 'email', providers: ['email'] },
    });

    expect(hasPasswordLogin(user)).toBe(true);
  });

  it('구글 identity만 있으면 바꿀 비밀번호가 없다', function googleOnlyCase() {
    const user = makeUser({
      identities: [{ provider: 'google' }],
      app_metadata: { provider: 'google', providers: ['google'] },
    });

    expect(hasPasswordLogin(user)).toBe(false);
  });

  // app_metadata.provider는 "마지막으로 로그인한 방법"이라 이메일 가입자가 구글로 한 번
  // 들어오면 'google'이 된다. 그것만 보면 비밀번호 변경이 사라져 버린다.
  it('구글로 마지막에 로그인했어도 이메일 identity가 남아 있으면 바꿀 수 있다', function mixedCase() {
    const user = makeUser({
      identities: [{ provider: 'email' }, { provider: 'google' }],
      app_metadata: { provider: 'google', providers: ['email', 'google'] },
    });

    expect(hasPasswordLogin(user)).toBe(true);
  });

  it('identities가 없으면 app_metadata로 판단한다', function fallbackCase() {
    expect(
      hasPasswordLogin(makeUser({ app_metadata: { providers: ['email'] } })),
    ).toBe(true);
    expect(hasPasswordLogin(makeUser({ app_metadata: { provider: 'email' } }))).toBe(true);
    expect(hasPasswordLogin(makeUser({ app_metadata: { provider: 'google' } }))).toBe(false);
    expect(hasPasswordLogin(makeUser({ identities: null }))).toBe(false);
  });

  it('로그인하지 않았으면 false다', function guestCase() {
    expect(hasPasswordLogin(null)).toBe(false);
  });
});
