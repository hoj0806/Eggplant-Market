import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostImageCarousel from './postImageCarousel';

/**
 * 상세 화면의 사진 넘김.
 *
 * **여기는 일부러 지연 로딩을 안 붙인다.** 목록 카드와 정반대다 —
 * 이 사진은 상세 화면에서 가장 크고 가장 먼저 보이는 것(LCP)이라, 늦게 받으면
 * "사진이 늦게 뜨는 앱"이 된다. 목록에서 아끼는 이유와 여기서 안 아끼는 이유가 같다:
 * **보이는 것을 먼저 준다.** 그 규칙이 조용히 뒤집히지 않도록 테스트로 박아 둔다.
 */

const IMAGES = ['https://example.test/1.jpg', 'https://example.test/2.jpg'];

describe('PostImageCarousel', function carouselSuite() {
  it('대표 사진은 즉시 받는다 — 지연 로딩을 붙이지 않는다', function eagerFirstImage() {
    render(<PostImageCarousel images={IMAGES} title="자전거" />);

    expect(screen.getByRole('img')).not.toHaveAttribute('loading', 'lazy');
  });

  it('사진이 없으면 안내를 보여 준다', function showsEmptyState() {
    render(<PostImageCarousel images={[]} title="자전거" />);

    expect(screen.getByText('사진이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('한 장이면 넘김 버튼을 그리지 않는다', function hidesNavForSingle() {
    render(<PostImageCarousel images={[IMAGES[0]]} title="자전거" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('다음을 누르면 다음 사진으로 간다', async function goesNext() {
    const user = userEvent.setup();
    render(<PostImageCarousel images={IMAGES} title="자전거" />);

    expect(screen.getByRole('img')).toHaveAttribute('src', IMAGES[0]);

    await user.click(screen.getByRole('button', { name: /다음/ }));

    expect(screen.getByRole('img')).toHaveAttribute('src', IMAGES[1]);
  });

  it('첫 장에서 이전을 누르면 마지막으로 돌아간다', async function wrapsAround() {
    const user = userEvent.setup();
    render(<PostImageCarousel images={IMAGES} title="자전거" />);

    await user.click(screen.getByRole('button', { name: /이전/ }));

    expect(screen.getByRole('img')).toHaveAttribute('src', IMAGES[1]);
  });
});
