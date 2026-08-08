import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PageHeader from './pageHeader';
import type { ReactNode } from 'react';

type HeaderProps = {
  backTo: string;
  backLabel: string;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
};

function renderHeader(props: HeaderProps) {
  render(
    <MemoryRouter>
      <PageHeader {...props} />
    </MemoryRouter>,
  );
}

describe('PageHeader', function pageHeaderSuite() {
  it('돌아가는 길과 제목을 보여준다', function showsBackAndTitle() {
    renderHeader({ backTo: '/my', backLabel: '마이페이지', title: '계정 설정' });

    expect(screen.getByRole('link', { name: '마이페이지' })).toHaveAttribute('href', '/my');
    expect(screen.getByRole('heading', { name: '계정 설정' })).toBeInTheDocument();
  });

  it('제목 아래 설명을 붙일 수 있다', function showsDescription() {
    renderHeader({
      backTo: '/my',
      backLabel: '마이페이지',
      title: '알림 설정',
      description: '끈 알림은 목록에도 쌓이지 않아요.',
    });

    expect(screen.getByText('끈 알림은 목록에도 쌓이지 않아요.')).toBeInTheDocument();
  });

  it('제목이 없는 화면도 있다', function worksWithoutTitle() {
    // 게시물 상세·남의 프로필은 제목 자리에 글이나 사람이 곧바로 온다.
    renderHeader({ backTo: '/', backLabel: '홈' });

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument();
  });

  it('돌아가는 길과 같은 줄에 메뉴를 둘 수 있다', function showsAction() {
    renderHeader({
      backTo: '/',
      backLabel: '홈',
      action: <button type="button">더보기</button>,
    });

    expect(screen.getByRole('button', { name: '더보기' })).toBeInTheDocument();
  });

  it('메뉴가 없어도 그 자리를 비워 두지 않는다', function noEmptyAction() {
    // action 없이도 지금까지의 세로형 화면과 결과가 같아야 한다 — 링크만 왼쪽에 남는다.
    renderHeader({ backTo: '/my', backLabel: '마이페이지', title: '프로필 수정' });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '마이페이지' })).toBeInTheDocument();
  });
});
