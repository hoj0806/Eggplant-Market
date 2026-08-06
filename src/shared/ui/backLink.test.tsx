import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackLink from './backLink';

function renderLink(props: { to: string; label: string; isLabelHidden?: boolean }) {
  render(
    <MemoryRouter>
      <BackLink {...props} />
    </MemoryRouter>,
  );
}

describe('BackLink', function backLinkSuite() {
  it('화살표와 목적지를 함께 보여준다', function showsArrowAndLabel() {
    renderLink({ to: '/my', label: '마이페이지' });

    const link = screen.getByRole('link', { name: '마이페이지' });

    expect(link).toHaveAttribute('href', '/my');
    expect(link).toHaveTextContent('← 마이페이지');
  });

  it('화살표는 보조기기가 읽지 않는다', function arrowIsDecorative() {
    // "왼쪽 화살표 마이페이지"로 읽히면 안 된다. 화살표는 눈으로 보는 표시일 뿐이다.
    renderLink({ to: '/my', label: '마이페이지' });

    expect(screen.getByRole('link', { name: '마이페이지' })).toBeInTheDocument();
  });

  it('글자를 감춰도 이름은 남는다', function keepsNameWhenHidden() {
    // 이 컴포넌트를 만든 이유 중 하나다 — 채팅방의 뒤로가기는 `←` 한 글자뿐이라
    // 스크린리더에 "왼쪽 화살표 링크"로 읽혔다.
    renderLink({ to: '/chats', label: '채팅 목록', isLabelHidden: true });

    const link = screen.getByRole('link', { name: '채팅 목록' });

    expect(link).toHaveAttribute('href', '/chats');
    expect(link).not.toHaveTextContent('채팅 목록');
  });

  it('감추지 않을 때는 aria-label을 붙이지 않는다', function noRedundantAriaLabel() {
    // 글자가 이미 이름이다. aria-label을 겹쳐 두면 둘이 어긋날 때 화면과 다르게 읽힌다.
    renderLink({ to: '/', label: '홈' });

    expect(screen.getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-label');
  });
});
