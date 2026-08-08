import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SignInPage from './signInPage';
import { AUTH_INITIAL_STATE, useAuthStore } from '../store/authStore';

// authApi는 supabaseClient(import.meta)에 닿는다(troble.md #5).
const mockSignInWithSocial = jest.fn();

jest.mock('../api/authApi', function mockAuthApi() {
  return {
    signInWithSocial: function signInWithSocial(provider: unknown) {
      return mockSignInWithSocial(provider);
    },
  };
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SignInPage', function signInPageSuite() {
  beforeEach(function resetAll() {
    jest.clearAllMocks();
    useAuthStore.setState({ ...AUTH_INITIAL_STATE, status: 'unauthenticated' });
    mockSignInWithSocial.mockResolvedValue(undefined);
  });

  // **이메일 칸이 없다는 것 자체가 이 화면의 규칙이다.** 되살아나면 여기서 걸린다.
  it('이메일·비밀번호를 묻지 않는다', function noEmailFieldCase() {
    renderPage();

    expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('비밀번호')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '회원가입' })).not.toBeInTheDocument();
    expect(screen.queryByText(/비밀번호를 잊으셨나요/)).not.toBeInTheDocument();
  });

  it('카카오와 구글 둘을 준다', function twoButtonsCase() {
    renderPage();

    expect(screen.getByRole('button', { name: '카카오로 시작하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '구글로 시작하기' })).toBeInTheDocument();
  });

  it('누른 프로바이더를 그대로 보낸다', function passesProviderCase() {
    renderPage();

    return userEvent
      .click(screen.getByRole('button', { name: '카카오로 시작하기' }))
      .then(function assertCalled() {
        return waitFor(function check() {
          expect(mockSignInWithSocial).toHaveBeenCalledWith('kakao');
        });
      });
  });

  // 하나를 눌렀을 때 둘 다 잠기면, 취소하고 다른 쪽을 고를 길이 없어진다.
  it('한 쪽을 누르는 동안 다른 쪽은 잠기지 않는다', async function pendingIsolationCase() {
    // 옮겨 가는 중이라 끝나지 않는 약속으로 둔다 — 실제로도 브라우저가 떠나므로 안 끝난다.
    mockSignInWithSocial.mockReturnValue(new Promise(function never() {}));
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: '카카오로 시작하기' }));

    expect(await screen.findByRole('button', { name: '카카오로 이동 중…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '구글로 시작하기' })).toBeEnabled();
  });

  // 카카오는 아직 Supabase에서 안 켰다. 그때 사용자가 보는 문구가 이것이다.
  it('아직 안 켠 프로바이더는 그 사실을 알린다', async function providerDisabledCase() {
    mockSignInWithSocial.mockRejectedValue({
      code: 'validation_failed',
      message: 'Unsupported provider: provider is not enabled',
    });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: '카카오로 시작하기' }));

    expect(
      await screen.findByText('해당 소셜 로그인이 아직 활성화되지 않았습니다.'),
    ).toBeInTheDocument();
  });
});
