import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteAccountSection from './deleteAccountSection';

// accountApi·authApi는 supabaseClient(import.meta)에 닿는다. ts-jest가 CommonJS로 옮기면서
// import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다(troble.md 참고).
const mockDeleteAccount = jest.fn();
const mockSignOutLocally = jest.fn();

jest.mock('../api/accountApi', function mockAccountApi() {
  return {
    deleteAccount: function deleteAccount() {
      return mockDeleteAccount();
    },
    changePassword: function changePassword() {
      return Promise.resolve();
    },
  };
});

jest.mock('../../auth/api/authApi', function mockAuthApi() {
  return {
    signOutLocally: function signOutLocally() {
      return mockSignOutLocally();
    },
  };
});

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <DeleteAccountSection />
    </QueryClientProvider>,
  );
}

describe('DeleteAccountSection', function deleteAccountSectionSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockDeleteAccount.mockResolvedValue(undefined);
    mockSignOutLocally.mockResolvedValue(undefined);
  });

  it('처음에는 확인 화면을 보여주지 않는다', function initialCase() {
    renderSection();

    expect(screen.getByRole('button', { name: '회원탈퇴' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '탈퇴하기' })).not.toBeInTheDocument();
  });

  it('확인 화면은 무엇이 사라지는지 함께 보여준다', async function lossListCase() {
    renderSection();

    await userEvent.click(screen.getByRole('button', { name: '회원탈퇴' }));

    expect(screen.getByText('올린 게시물과 사진')).toBeInTheDocument();
    expect(screen.getByText('주고받은 채팅과 대화 내용')).toBeInTheDocument();
  });

  // 되돌릴 수 없는 일이라 "한 번 더 누르기"로는 모자라다.
  it('확인 문구를 적기 전에는 탈퇴 버튼이 잠겨 있다', async function lockedCase() {
    renderSection();

    await userEvent.click(screen.getByRole('button', { name: '회원탈퇴' }));
    expect(screen.getByRole('button', { name: '탈퇴하기' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/탈퇴합니다.*입력해 주세요/), '탈퇴');
    expect(screen.getByRole('button', { name: '탈퇴하기' })).toBeDisabled();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('문구를 정확히 적으면 탈퇴하고 이 기기의 세션을 걷어낸다', async function deleteCase() {
    renderSection();

    await userEvent.click(screen.getByRole('button', { name: '회원탈퇴' }));
    await userEvent.type(screen.getByLabelText(/탈퇴합니다.*입력해 주세요/), '탈퇴합니다');
    await userEvent.click(screen.getByRole('button', { name: '탈퇴하기' }));

    await waitFor(function assertDeleted() {
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });
    expect(mockSignOutLocally).toHaveBeenCalledTimes(1);
  });

  it('취소하면 아무 일도 일어나지 않는다', async function cancelCase() {
    renderSection();

    await userEvent.click(screen.getByRole('button', { name: '회원탈퇴' }));
    await userEvent.type(screen.getByLabelText(/탈퇴합니다.*입력해 주세요/), '탈퇴합니다');
    await userEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '회원탈퇴' })).toBeInTheDocument();
  });

  it('실패하면 이유를 보여준다', async function errorCase() {
    mockDeleteAccount.mockRejectedValue(new Error('Failed to fetch'));
    renderSection();

    await userEvent.click(screen.getByRole('button', { name: '회원탈퇴' }));
    await userEvent.type(screen.getByLabelText(/탈퇴합니다.*입력해 주세요/), '탈퇴합니다');
    await userEvent.click(screen.getByRole('button', { name: '탈퇴하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '네트워크 연결을 확인해 주세요.',
    );
  });
});
