import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PostCard from './postCard';
import type { PostSummary } from '../../post/types';

/**
 * 카드가 그리는 것과 **사진을 언제 받는가**.
 *
 * 지연 로딩은 눈에 안 보이는 최적화라 한 번 빠지면 아무도 모른다. 목록은 스무 칸씩
 * 이어 붙는데 전부 한 번에 받으면 첫 화면에 보이지도 않는 사진이 대역폭을 가져간다.
 */

const BASE_POST: PostSummary = {
  id: 1,
  title: '자전거 팝니다',
  price: 90000,
  status: 'selling',
  thumbnailUrl: 'https://example.test/photo.jpg',
  dongName: '서울 동대문구 이문동',
  likeCount: 2,
  viewCount: 30,
  commentCount: 1,
  bumpedAt: '2026-08-08T00:00:00.000Z',
  distanceM: null,
};

function renderCard(post: Partial<PostSummary> = {}) {
  render(
    <MemoryRouter>
      <ul>
        <PostCard post={{ ...BASE_POST, ...post }} now={new Date('2026-08-08T01:00:00.000Z')} />
      </ul>
    </MemoryRouter>,
  );
}

describe('PostCard', function postCardSuite() {
  it('제목·가격·동네를 보여 준다', function showsBasics() {
    renderCard();

    expect(screen.getByText('자전거 팝니다')).toBeInTheDocument();
    expect(screen.getByText(/90,000/)).toBeInTheDocument();
    expect(screen.getByText(/이문동/)).toBeInTheDocument();
  });

  it('상세로 가는 링크가 걸린다', function linksToDetail() {
    renderCard();

    expect(screen.getByRole('link')).toHaveAttribute('href', '/posts/1');
  });

  it('사진은 화면에 들어올 때 받는다', function lazyLoadsThumbnail() {
    renderCard();

    const image = screen.getByRole('img', { name: '자전거 팝니다' });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
  });

  it('사진이 없으면 자리만 남기고 img를 만들지 않는다', function showsPlaceholder() {
    renderCard({ thumbnailUrl: null });

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('사진 없음')).toBeInTheDocument();
  });

  it('판매중이 아니면 상태 배지가 붙는다', function showsStatusBadge() {
    renderCard({ status: 'sold' });

    expect(screen.getByText('거래완료')).toBeInTheDocument();
  });

  it('판매중이면 배지를 붙이지 않는다', function hidesBadgeWhenSelling() {
    renderCard({ status: 'selling' });

    expect(screen.queryByText('거래완료')).toBeNull();
    expect(screen.queryByText('예약중')).toBeNull();
  });
});
