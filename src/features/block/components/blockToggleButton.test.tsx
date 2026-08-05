import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BlockToggleButton from './blockToggleButton';

// blockApi는 supabaseClient(import.meta)에 닿는다. ts-jest가 CommonJS로 옮기면서
// import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다(troble.md 참고).
const mockBlockUser = jest.fn();
const mockUnblockUser = jest.fn();
const mockFetchIsBlocked = jest.fn();

jest.mock('../api/blockApi', function mockBlockApi() {
  return {
    blockUser: function blockUser(input: unknown) {
      return mockBlockUser(input);
    },
    unblockUser: function unblockUser(input: unknown) {
      return mockUnblockUser(input);
    },
    fetchIsBlocked: function fetchIsBlocked(input: unknown) {
      return mockFetchIsBlocked(input);
    },
    fetchBlockedUsers: function fetchBlockedUsers() {
      return Promise.resolve([]);
    },
  };
});

const VIEWER_ID = 'viewer-1';
const TARGET_ID = 'target-1';

function renderButton() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <BlockToggleButton
        viewerId={VIEWER_ID}
        targetId={TARGET_ID}
        targetNickname="가지팔이"
        variant="menu"
      />
    </QueryClientProvider>,
  );
}

describe('BlockToggleButton', function blockToggleButtonSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockBlockUser.mockResolvedValue(undefined);
    mockUnblockUser.mockResolvedValue(undefined);
    mockFetchIsBlocked.mockResolvedValue(false);
  });

  // 차단 여부를 모르는 동안 잘못 그리면 "차단 해제"를 눌렀는데 차단이 걸리는 자리가 된다.
  it('차단 여부를 확인하기 전에는 버튼을 그리지 않는다', function loadingCase() {
    renderButton();

    expect(screen.getByText('차단 상태 확인 중…')).toBeInTheDocument();
  });

  it('차단은 한 번 더 확인해야 실행된다', async function confirmCase() {
    renderButton();

    await userEvent.click(await screen.findByRole('button', { name: '가지팔이님 차단하기' }));
    expect(mockBlockUser).not.toHaveBeenCalled();
    expect(
      screen.getByText(/가지팔이님을 차단하면 서로의 게시물과 채팅이 보이지 않아요/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '차단하기' }));

    await waitFor(function assertBlocked() {
      expect(mockBlockUser).toHaveBeenCalledWith({
        blockerId: VIEWER_ID,
        blockedId: TARGET_ID,
      });
    });
  });

  it('확인을 취소하면 아무 일도 일어나지 않는다', async function cancelCase() {
    renderButton();

    await userEvent.click(await screen.findByRole('button', { name: '가지팔이님 차단하기' }));
    await userEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(mockBlockUser).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '가지팔이님 차단하기' })).toBeInTheDocument();
  });

  // 되돌리는 쪽은 잃는 것이 없다.
  it('차단 해제는 묻지 않고 바로 실행한다', async function unblockCase() {
    mockFetchIsBlocked.mockResolvedValue(true);
    renderButton();

    await userEvent.click(await screen.findByRole('button', { name: '차단 해제' }));

    await waitFor(function assertUnblocked() {
      expect(mockUnblockUser).toHaveBeenCalledWith({
        blockerId: VIEWER_ID,
        blockedId: TARGET_ID,
      });
    });
  });

  it('실패하면 이유를 보여준다', async function errorCase() {
    mockBlockUser.mockRejectedValue({ code: '42501', message: 'row-level security' });
    renderButton();

    await userEvent.click(await screen.findByRole('button', { name: '가지팔이님 차단하기' }));
    await userEvent.click(screen.getByRole('button', { name: '차단하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '차단은 로그인한 뒤에 할 수 있어요.',
    );
  });
});
