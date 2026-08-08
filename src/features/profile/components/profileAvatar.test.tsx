import { render, screen } from '@testing-library/react';
import ProfileAvatar from './profileAvatar';

/**
 * 프로필 사진은 **목록마다 따라다니는 이미지**다 — 댓글·채팅방·후기 한 줄마다 하나씩 선다.
 * 그래서 한 화면에 수십 개가 생기고 대부분은 스크롤해야 보인다. 지연 로딩이 가장 값을 하는 자리다.
 */

describe('ProfileAvatar', function profileAvatarSuite() {
  it('사진이 있으면 화면에 들어올 때 받는다', function lazyLoadsPhoto() {
    render(<ProfileAvatar nickname="홍길동" avatarUrl="https://example.test/a.jpg" size="sm" />);

    const image = screen.getByRole('img', { name: '홍길동님의 프로필 사진' });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
  });

  it('사진이 없으면 닉네임 첫 글자를 보여 준다 — 받을 것이 없다', function showsInitial() {
    render(<ProfileAvatar nickname="홍길동" avatarUrl={null} size="md" />);

    expect(screen.getByText('홍')).toBeInTheDocument();
  });

  it('첫 글자는 코드 포인트 단위로 자른다', function handlesEmoji() {
    render(<ProfileAvatar nickname="🍀행운" avatarUrl={null} size="md" />);

    // 서로게이트 쌍을 반으로 자르면 깨진 글자가 나온다.
    expect(screen.getByText('🍀')).toBeInTheDocument();
  });

  it('닉네임이 비어 있으면 사람 아이콘을 그린다', function fallsBackToIcon() {
    render(<ProfileAvatar nickname="   " avatarUrl={null} size="lg" />);

    expect(screen.getByRole('img', { name: /기본 프로필 이미지/ })).toBeInTheDocument();
  });
});
