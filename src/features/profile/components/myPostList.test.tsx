import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyPostList from './myPostList';
import type { MyPostsQueryResult } from '../hooks/useMyPostsQuery';
import type { MyListKind, MyPostSummary } from '../types';

const EMPTY_MESSAGE = '아직 찜한 물건이 없어요.';

function createPost(id: number, sortAt: string): MyPostSummary {
  return {
    id,
    title: `물건 ${id}`,
    price: 12000,
    status: 'selling',
    thumbnailUrl: null,
    dongName: '서울특별시 강북구 수유동',
    likeCount: 0,
    viewCount: 0,
    bumpedAt: '2026-08-01T00:00:00.000Z',
    distanceM: null,
    sortAt,
  };
}

type QueryState = {
  isLoading?: boolean;
  isError?: boolean;
  pages?: MyPostSummary[][];
  isFetchingNextPage?: boolean;
};

/**
 * 훅 결과 중 목록이 실제로 읽는 칸만 채운다.
 * UseInfiniteQueryResult 전체를 만들 수는 없어 unknown을 거쳐 좁힌다(any는 쓰지 않는다).
 */
function createQuery(state: QueryState): MyPostsQueryResult {
  return {
    isLoading: state.isLoading === true,
    isError: state.isError === true,
    data: state.pages === undefined ? undefined : { pages: state.pages, pageParams: [] },
    hasNextPage: false,
    isFetchingNextPage: state.isFetchingNextPage === true,
    fetchNextPage: jest.fn(),
  } as unknown as MyPostsQueryResult;
}

function renderList(kind: MyListKind, state: QueryState) {
  render(
    <MemoryRouter>
      <MyPostList kind={kind} query={createQuery(state)} emptyMessage={EMPTY_MESSAGE} />
    </MemoryRouter>,
  );
}

describe('MyPostList', function myPostListSuite() {
  it('불러오는 동안에는 그렇게 알려 준다', function loadingCase() {
    renderList('likes', { isLoading: true });

    expect(screen.getByText('불러오는 중입니다…')).toBeInTheDocument();
  });

  it('실패하면 오류를 알려 준다', function errorCase() {
    renderList('likes', { isError: true });

    expect(screen.getByRole('alert')).toHaveTextContent('목록을 불러오지 못했습니다.');
  });

  it('목록이 비었으면 목록마다 다른 안내를 보여준다', function emptyCase() {
    renderList('likes', { pages: [[]] });

    expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
  });

  it('여러 페이지를 이어 붙여 한 목록으로 그린다', function multiPageCase() {
    renderList('likes', {
      pages: [
        [createPost(1, '2026-08-03T00:00:00.000Z')],
        [createPost(2, '2026-08-02T00:00:00.000Z')],
      ],
    });

    expect(screen.getByText('물건 1')).toBeInTheDocument();
    expect(screen.getByText('물건 2')).toBeInTheDocument();
  });

  it('카드를 누르면 그 게시물로 간다', function linkCase() {
    renderList('likes', { pages: [[createPost(7, '2026-08-03T00:00:00.000Z')]] });

    expect(screen.getByRole('link')).toHaveAttribute('href', '/posts/7');
  });

  it('구매내역에서는 시간 자리에 구매한 날짜가 온다', function purchaseTimeTextCase() {
    const soldAt = new Date('2026-07-30T05:00:00.000Z');
    renderList('purchases', { pages: [[createPost(3, soldAt.toISOString())]] });

    const expected = `${soldAt.getFullYear()}년 ${soldAt.getMonth() + 1}월 ${soldAt.getDate()}일 구매`;

    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
  });

  it('다음 페이지를 받는 중이면 그렇게 알려 준다', function fetchingNextCase() {
    renderList('likes', {
      pages: [[createPost(1, '2026-08-03T00:00:00.000Z')]],
      isFetchingNextPage: true,
    });

    expect(screen.getByText('더 불러오는 중입니다…')).toBeInTheDocument();
  });
});
