import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordPage from './resetPasswordPage';
import { AUTH_INITIAL_STATE, useAuthStore } from '../store/authStore';
import type { AuthSession } from '../types';

// authApi는 supabaseClient(import.meta)에 닿는다(troble.md #5).
const mockUpdatePassword = jest.fn();

jest.mock('../api/authApi', function mockAuthApi() {
  return {
    updatePassword: function updatePassword(password: unknown) {
      return mockUpdatePassword(password);
    },
  };
});

const mockNavigate = jest.fn();

jest.mock('react-router-dom', function mockRouter() {
  return {
    ...jest.requireActual('react-router-dom'),
    useNavigate: function useNavigate() {
      return mockNavigate;
    },
  };
});

function createSession(): AuthSession {
  return {
    access_token: 'access-1',
    refresh_token: 'refresh-1',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      email: 'forgot@example.com',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2026-08-01T00:00:00.000Z',
    },
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 재설정 링크로 제대로 들어온 상태 — 세션이 서고 PASSWORD_RECOVERY까지 왔다. */
function arriveFromResetLink(): void {
  useAuthStore.getState().setSession(createSession());
  useAuthStore.getState().beginPasswordRecovery();
}

describe('ResetPasswordPage', function resetPasswordSuite() {
  beforeEach(function resetAll() {
    jest.clearAllMocks();
    useAuthStore.setState({ ...AUTH_INITIAL_STATE, isPasswordRecovery: false });
    mockUpdatePassword.mockResolvedValue(undefined);
  });

  // **여기가 이 화면의 핵심이다.** 로그인만 돼 있으면 통과시키면, 남이 열어 둔 브라우저로
  // 이 주소만 쳐서 비밀번호를 바꿔 계정을 가져갈 수 있다.
  it('링크 없이 로그인만 돼 있으면 폼을 주지 않는다', async function noRecoveryCase() {
    useAuthStore.getState().setSession(createSession());
    renderPage();

    expect(
      await screen.findByText(/링크가 만료되었거나 이미 사용되었습니다/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('새 비밀번호')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '재설정 링크 다시 받기' })).toBeInTheDocument();
  });

  // 세션이 서기 전에 만료 안내를 내면 제대로 들어온 사람에게도 한 번 깜빡인다.
  it('세션을 확인하는 동안에는 아무것도 단정하지 않는다', function loadingCase() {
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('잠시만 기다려 주세요.');
    expect(screen.queryByText(/링크가 만료되었거나/)).not.toBeInTheDocument();
  });

  it('링크로 들어오면 새 비밀번호를 정할 수 있다', async function happyPathCase() {
    arriveFromResetLink();
    renderPage();

    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'eggplant1234');
    await userEvent.type(screen.getByLabelText('새 비밀번호 확인'), 'eggplant1234');
    await userEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    await waitFor(function assertUpdated() {
      expect(mockUpdatePassword).toHaveBeenCalledWith('eggplant1234');
    });
    // 로그아웃시키지 않는다 — 방금 본인임을 증명한 사람이다.
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  // 안 닫으면 한 번 받은 링크로 몇 번이고 바꿀 수 있는 창이 남는다.
  it('바꾸고 나면 재설정 창이 닫힌다', async function closesWindowCase() {
    arriveFromResetLink();
    renderPage();

    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'eggplant1234');
    await userEvent.type(screen.getByLabelText('새 비밀번호 확인'), 'eggplant1234');
    await userEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    await waitFor(function assertClosed() {
      expect(useAuthStore.getState().isPasswordRecovery).toBe(false);
    });
  });

  it('두 칸이 다르면 보내지 않는다', async function mismatchCase() {
    arriveFromResetLink();
    renderPage();

    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'eggplant1234');
    await userEvent.type(screen.getByLabelText('새 비밀번호 확인'), 'eggplant4321');
    await userEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    expect(mockUpdatePassword).not.toHaveBeenCalled();
    expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
  });

  it('만료된 링크로 보내면 다시 받으라고 알린다', async function expiredOnSubmitCase() {
    mockUpdatePassword.mockRejectedValue({
      code: 'otp_expired',
      message: 'Email link is invalid or has expired',
    });
    arriveFromResetLink();
    renderPage();

    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'eggplant1234');
    await userEvent.type(screen.getByLabelText('새 비밀번호 확인'), 'eggplant1234');
    await userEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    expect(
      await screen.findByText(/링크가 만료되었거나 이미 사용되었습니다/),
    ).toBeInTheDocument();
  });
});
