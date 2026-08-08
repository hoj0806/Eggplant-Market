import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportSheet from './reportSheet';
import type { ReportTarget } from '../types';

// reportApi는 supabaseClient(import.meta)에 닿는다. ts-jest가 CommonJS로 옮기면서
// import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다(troble.md 참고).
const mockCreateReport = jest.fn();

jest.mock('../api/reportApi', function mockReportApi() {
  return {
    createReport: function createReport(input: unknown) {
      return mockCreateReport(input);
    },
  };
});

const POST_TARGET: ReportTarget = { type: 'post', id: '42', label: '맥북 에어 M2' };
const USER_TARGET: ReportTarget = {
  type: 'user',
  id: '11111111-2222-3333-4444-555555555555',
  label: '가지팔이님',
};

function renderSheet(target: ReportTarget, onClose = jest.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ReportSheet
        target={target}
        onClose={onClose}
        completionAction={<button type="button">차단하기</button>}
      />
    </QueryClientProvider>,
  );

  return onClose;
}

describe('ReportSheet', function reportSheetSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockCreateReport.mockResolvedValue(undefined);
  });

  it('대상에 맞는 사유만 보여준다', function reasonsByTarget() {
    renderSheet(POST_TARGET);

    expect(
      screen.getByRole('radio', { name: '전문판매업자예요 / 판매금지 물품이에요' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '욕설·비방을 해요' })).not.toBeInTheDocument();
  });

  it('사유를 고르지 않으면 보내지 않는다', async function requiresReason() {
    renderSheet(POST_TARGET);

    await userEvent.click(screen.getByRole('button', { name: '신고하기' }));

    expect(mockCreateReport).not.toHaveBeenCalled();
    expect(await screen.findByText('신고 사유를 골라 주세요.')).toBeInTheDocument();
  });

  it('고른 사유와 상세가 그대로 넘어간다', async function submitsChosenValues() {
    renderSheet(USER_TARGET);

    await userEvent.click(screen.getByRole('radio', { name: '욕설·비방을 해요' }));
    await userEvent.type(screen.getByLabelText('상세 내용 (선택)'), '채팅으로 욕을 했어요');
    await userEvent.click(screen.getByRole('button', { name: '신고하기' }));

    await waitFor(function assertSubmitted() {
      expect(mockCreateReport).toHaveBeenCalledWith({
        targetType: 'user',
        targetId: USER_TARGET.id,
        reason: 'abuse',
        detail: '채팅으로 욕을 했어요',
      });
    });
  });

  // 신고자는 자기 신고도 다시 볼 수 없다. "접수됐다"는 안내 한 번이 유일한 답이라
  // 보내자마자 닫아 버리면 사용자는 아무 일도 일어나지 않은 것으로 본다.
  it('보내고 나서 바로 닫지 않고 접수 안내를 띄운다', async function showsCompletion() {
    const onClose = renderSheet(POST_TARGET);

    await userEvent.click(screen.getByRole('radio', { name: '사기가 의심돼요' }));
    await userEvent.click(screen.getByRole('button', { name: '신고하기' }));

    expect(await screen.findByText('신고가 접수되었어요.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('접수 안내에서 차단을 함께 권한다', async function offersBlock() {
    renderSheet(POST_TARGET);

    await userEvent.click(screen.getByRole('radio', { name: '사기가 의심돼요' }));
    await userEvent.click(screen.getByRole('button', { name: '신고하기' }));

    // 신고만으로는 아무것도 사라지지 않는다 — 지금 안 보이게 하는 일은 차단이 한다.
    expect(await screen.findByRole('button', { name: '차단하기' })).toBeInTheDocument();
  });

  it('서버가 거절한 이유를 그대로 보여준다', async function showsServerMessage() {
    mockCreateReport.mockRejectedValue({
      code: 'P0001',
      message: '이미 신고한 대상입니다.',
    });

    renderSheet(POST_TARGET);

    await userEvent.click(screen.getByRole('radio', { name: '사기가 의심돼요' }));
    await userEvent.click(screen.getByRole('button', { name: '신고하기' }));

    expect(await screen.findByText('이미 신고한 대상입니다.')).toBeInTheDocument();
    expect(screen.queryByText('신고가 접수되었어요.')).not.toBeInTheDocument();
  });
});
