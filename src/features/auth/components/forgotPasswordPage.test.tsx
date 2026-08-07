import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from './forgotPasswordPage';

// authApi는 supabaseClient(import.meta)에 닿는다. ts-jest가 CommonJS로 옮기면서
// import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다(troble.md #5).
const mockSendPasswordResetEmail = jest.fn();

jest.mock('../api/authApi', function mockAuthApi() {
  return {
    sendPasswordResetEmail: function sendPasswordResetEmail(email: unknown) {
      return mockSendPasswordResetEmail(email);
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
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ForgotPasswordPage', function forgotPasswordSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it('형식이 틀린 이메일은 보내지 않는다', async function invalidEmailCase() {
    renderPage();

    await userEvent.type(screen.getByLabelText('이메일'), '가지마켓');
    await userEvent.click(screen.getByRole('button', { name: '재설정 링크 받기' }));

    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(screen.getByText('이메일 형식이 올바르지 않습니다.')).toBeInTheDocument();
  });

  // **가입 여부를 알려 주지 않는다.** "그런 이메일은 없습니다"를 내면 주소를 넣어 보며
  // 누가 이 서비스를 쓰는지 알아낼 수 있다 — 동네가 붙어 다니는 서비스라 가볍지 않다.
  it('보낸 뒤에도 가입 여부를 말하지 않는다', async function neutralNoticeCase() {
    renderPage();

    await userEvent.type(screen.getByLabelText('이메일'), 'eggplant@example.com');
    await userEvent.click(screen.getByRole('button', { name: '재설정 링크 받기' }));

    await waitFor(function assertSent() {
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith('eggplant@example.com');
    });

    expect(await screen.findByText(/가입된 이메일이라면 재설정 링크를 보냈습니다/)).toBeInTheDocument();
  });

  // 내장 SMTP의 낮은 한도에 걸리는 자리다. 무엇을 기다려야 하는지 적어 준다.
  it('메일 발송 한도에 걸리면 그 사실을 알린다', async function rateLimitCase() {
    mockSendPasswordResetEmail.mockRejectedValue({
      code: 'over_email_send_rate_limit',
      message: 'email rate limit exceeded',
    });
    renderPage();

    await userEvent.type(screen.getByLabelText('이메일'), 'eggplant@example.com');
    await userEvent.click(screen.getByRole('button', { name: '재설정 링크 받기' }));

    expect(
      await screen.findByText('메일을 너무 자주 요청했습니다. 잠시 후 다시 시도해 주세요.'),
    ).toBeInTheDocument();
  });
});
