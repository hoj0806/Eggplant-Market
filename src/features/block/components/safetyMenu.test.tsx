import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SafetyMenu from './safetyMenu';

// 두 api 모두 supabaseClient(import.meta)에 닿는다(troble.md 참고).
jest.mock('../api/blockApi', function mockBlockApi() {
  return {
    blockUser: function blockUser() {
      return Promise.resolve();
    },
    unblockUser: function unblockUser() {
      return Promise.resolve();
    },
    fetchIsBlocked: function fetchIsBlocked() {
      return Promise.resolve(false);
    },
    fetchBlockedUsers: function fetchBlockedUsers() {
      return Promise.resolve([]);
    },
  };
});

jest.mock('../../report/api/reportApi', function mockReportApi() {
  return {
    createReport: function createReport() {
      return Promise.resolve();
    },
  };
});

const VIEWER_ID = 'viewer-1';
const TARGET_ID = 'target-1';

type RenderOptions = {
  viewerId?: string | null;
  withPost?: boolean;
};

function renderMenu(options: RenderOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <SafetyMenu
        viewerId={options.viewerId === undefined ? VIEWER_ID : options.viewerId}
        targetUserId={TARGET_ID}
        targetNickname="가지팔이"
        post={options.withPost === true ? { id: 42, title: '맥북 에어 M2' } : undefined}
      />
    </QueryClientProvider>,
  );
}

async function openMenu(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: '신고 · 차단' }));
}

describe('SafetyMenu', function safetyMenuSuite() {
  it('게스트에게는 아무것도 그리지 않는다', function guestCase() {
    // 신고도 차단도 로그인이 있어야 한다. 서버도 같은 판단을 한다.
    renderMenu({ viewerId: null });

    expect(screen.queryByRole('button', { name: '신고 · 차단' })).not.toBeInTheDocument();
  });

  it('자기 자신에게는 아무것도 그리지 않는다', function selfCase() {
    renderMenu({ viewerId: TARGET_ID });

    expect(screen.queryByRole('button', { name: '신고 · 차단' })).not.toBeInTheDocument();
  });

  it('열기 전에는 메뉴가 보이지 않는다', function closedCase() {
    renderMenu();

    expect(screen.queryByRole('button', { name: '가지팔이님 신고' })).not.toBeInTheDocument();
  });

  it('게시물이 없는 자리에서는 사용자만 신고할 수 있다', async function userOnlyCase() {
    renderMenu();
    await openMenu();

    expect(screen.getByRole('button', { name: '가지팔이님 신고' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '게시물 신고' })).not.toBeInTheDocument();
  });

  it('게시물 화면에서는 글도 신고할 수 있다', async function postCase() {
    renderMenu({ withPost: true });
    await openMenu();

    expect(screen.getByRole('button', { name: '게시물 신고' })).toBeInTheDocument();
  });

  it('게시물 신고 시트는 그 글을 대상으로 연다', async function postSheetCase() {
    renderMenu({ withPost: true });
    await openMenu();

    await userEvent.click(screen.getByRole('button', { name: '게시물 신고' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('게시물 신고');
    expect(dialog).toHaveTextContent('맥북 에어 M2');
    // 게시물 사유는 사용자 사유와 다르다.
    expect(
      screen.getByRole('radio', { name: '전문판매업자예요 / 판매금지 물품이에요' }),
    ).toBeInTheDocument();
  });

  it('사용자 신고 시트는 그 사람을 대상으로 연다', async function userSheetCase() {
    renderMenu({ withPost: true });
    await openMenu();

    await userEvent.click(screen.getByRole('button', { name: '가지팔이님 신고' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('사용자 신고');
    expect(screen.getByRole('radio', { name: '욕설·비방을 해요' })).toBeInTheDocument();
  });

  it('시트를 닫으면 사라진다', async function closeSheetCase() {
    renderMenu();
    await openMenu();
    await userEvent.click(screen.getByRole('button', { name: '가지팔이님 신고' }));
    await screen.findByRole('dialog');

    await userEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('메뉴에 차단이 함께 있다', async function blockInMenuCase() {
    renderMenu();
    await openMenu();

    expect(await screen.findByRole('button', { name: '가지팔이님 차단하기' })).toBeInTheDocument();
  });
});
