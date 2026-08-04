import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewListItem from './reviewListItem';
import type { ReceivedReview } from '../types';

const NOW = new Date('2026-08-05T00:00:00.000Z');

function toReview(overrides: Partial<ReceivedReview> = {}): ReceivedReview {
  return {
    id: 1,
    postId: 7,
    postTitle: '자전거',
    reviewerId: 'reviewer-1',
    reviewerNickname: '호박이웃',
    reviewerAvatarUrl: null,
    rating: 'good',
    mannerTags: ['시간 약속을 잘 지켜요'],
    comment: '친절했어요',
    createdAt: '2026-08-04T00:00:00.000Z',
    ...overrides,
  };
}

function renderItem(review: ReceivedReview) {
  render(
    <MemoryRouter>
      <ul>
        <ReviewListItem review={review} now={NOW} />
      </ul>
    </MemoryRouter>,
  );
}

describe('ReviewListItem', function reviewListItemSuite() {
  it('쓴 사람 이름이 그 사람 프로필로 가는 링크다', function linksToReviewer() {
    renderItem(toReview());

    expect(screen.getByRole('link', { name: '호박이웃' })).toHaveAttribute(
      'href',
      '/users/reviewer-1',
    );
  });

  it('평가·태그·한 줄 후기를 함께 보여준다', function showsContent() {
    renderItem(toReview());

    expect(screen.getByText('좋아요', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('시간 약속을 잘 지켜요')).toBeInTheDocument();
    expect(screen.getByText('친절했어요')).toBeInTheDocument();
  });

  it('한 줄 후기를 안 쓴 후기도 그린다', function handlesMissingComment() {
    renderItem(toReview({ comment: null, mannerTags: [] }));

    expect(screen.getByRole('link', { name: '자전거' })).toHaveAttribute('href', '/posts/7');
  });

  it('점수는 어디에도 적지 않는다', function hidesScore() {
    renderItem(toReview());

    expect(screen.queryByText('0.5', { exact: false })).not.toBeInTheDocument();
  });
});
