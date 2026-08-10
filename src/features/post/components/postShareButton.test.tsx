import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostShareButton from './postShareButton';
import type { PostDetail } from '../types';

// 로더는 import.meta.env(카카오 앱키)에 닿는다. 실제 모듈은 로드하지 않는다.
const mockLoadKakaoShare = jest.fn();

jest.mock('../../../shared/lib/kakaoShareLoader', function mockLoader() {
  return {
    loadKakaoShare: function loadKakaoShare() {
      return mockLoadKakaoShare();
    },
  };
});

const mockSendDefault = jest.fn();
const mockWriteText = jest.fn();

function makePost(): PostDetail {
  return {
    id: 7,
    title: '아이패드 9세대',
    description: '생활기스 조금 있어요.',
    price: 250000,
    status: 'selling',
    categoryId: 14,
    categoryName: '태블릿/PC',
    dongName: '서울특별시 성북구 석관동',
    tradePlace: null,
    images: ['https://cdn.example.com/photo.png'],
    viewCount: 3,
    likeCount: 1,
    commentCount: 0,
    isLiked: false,
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    bumpedAt: '2026-08-10T00:00:00.000Z',
    soldAt: null,
    seller: { id: 'seller-1', nickname: '가지팔이', avatarUrl: null, mannerTemp: 36.5 },
    buyer: null,
  };
}

function clickShare(): Promise<void> {
  return userEvent.click(screen.getByRole('button', { name: '카카오톡으로 공유' }));
}

describe('PostShareButton', function shareButtonSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockLoadKakaoShare.mockResolvedValue({ Share: { sendDefault: mockSendDefault } });
    mockWriteText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true,
    });
  });

  it('그 글의 카드를 카카오톡으로 보낸다', async function sendsCardCase() {
    render(<PostShareButton post={makePost()} />);

    await clickShare();

    await waitFor(function sent() {
      expect(mockSendDefault).toHaveBeenCalled();
    });

    const template = mockSendDefault.mock.calls[0][0];
    expect(template.content.title).toBe('아이패드 9세대');
    expect(template.content.link.webUrl).toContain('/posts/7');
  });

  /**
   * SDK를 못 받는 자리가 있다(네트워크·도메인 미등록). **아무 일도 안 일어나면
   * "눌렀는데 왜 안 되지"** 가 되므로 주소를 복사하고 그렇게 말해 준다 —
   * 공유의 목적(이 글을 남에게 보낸다)은 그것으로도 이뤄진다.
   */
  it('SDK를 못 받으면 링크를 복사하고 그렇게 말한다', async function fallbackCopyCase() {
    mockLoadKakaoShare.mockRejectedValue(new Error('kakao_share_load_failed'));
    render(<PostShareButton post={makePost()} />);

    await clickShare();

    await waitFor(function copied() {
      expect(screen.getByRole('status')).toHaveTextContent('링크를 복사했어요');
    });
    expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('/posts/7'));
  });

  it('복사도 막히면 실패를 말한다 — 조용히 삼키지 않는다', async function fallbackFailedCase() {
    mockLoadKakaoShare.mockRejectedValue(new Error('kakao_share_load_failed'));
    mockWriteText.mockRejectedValue(new Error('denied'));
    render(<PostShareButton post={makePost()} />);

    await clickShare();

    await waitFor(function failed() {
      expect(screen.getByRole('alert')).toHaveTextContent('공유하지 못했어요');
    });
  });
});
