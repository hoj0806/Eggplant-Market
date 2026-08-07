import PostCard from '../../browse/components/postCard';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import { useNow } from '../../../shared/hooks/useNow';
import { toMyListTimeText } from '../utils/myListTimeText';
import type { ReactNode } from 'react';
import type { MyPostsQueryResult } from '../hooks/useMyPostsQuery';
import type { MyListKind, MyPostSummary } from '../types';

type MyPostListProps = {
  kind: MyListKind;
  query: MyPostsQueryResult;
  /** 목록이 비었을 때 보여줄 문구. 목록마다 할 말이 다르다. */
  emptyMessage: string;
  /**
   * 카드마다 아래에 붙일 것. 지금은 판매관리의 끌어올리기 버튼 하나뿐이다.
   *
   * 어떤 버튼인지는 목록이 정한다 — 여기는 "네 목록이 함께 쓰는 몸통"이라
   * 특정 목록만의 사정을 알고 있으면 그만큼 다음 목록이 붙기 어려워진다.
   */
  renderAction?(post: MyPostSummary, now: Date): ReactNode;
};

const MESSAGE_CLASS = 'py-8 text-center text-sm text-gray-500 dark:text-gray-400';

/**
 * 마이페이지 네 목록이 함께 쓰는 몸통.
 *
 * 페이지들은 "어떤 목록인가"만 알고, 그리는 방법은 전부 여기 있다.
 * 카드는 홈·검색과 같은 PostCard다 — 같은 게시물이 화면마다 다르게 보일 이유가 없다.
 * 시간 문구만 목록의 뜻에 맞게 바꿔 넘긴다.
 */
function MyPostList(props: MyPostListProps) {
  const query = props.query;

  const sentinelRef = useInfiniteScroll({
    hasNextPage: query.hasNextPage,
    isFetching: query.isFetchingNextPage,
    onLoadMore: function loadMore(): void {
      query.fetchNextPage();
    },
  });

  // 카드마다 new Date()를 부르면 같은 목록에서 기준 시각이 어긋난다.
  // 판매관리의 끌어올리기 버튼이 이 값을 보고 잠기므로, 멈춰 있으면 24시간이 지나도
  // 버튼이 잠긴 채로 남는다.
  const now = useNow();

  if (query.isLoading) {
    return <p className={MESSAGE_CLASS}>불러오는 중입니다…</p>;
  }

  if (query.isError) {
    return (
      <p role="alert" className="py-8 text-center text-sm text-red-600 dark:text-red-400">
        목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  const posts = (query.data?.pages ?? []).flat();

  if (posts.length === 0) {
    return <p className={MESSAGE_CLASS}>{props.emptyMessage}</p>;
  }

  return (
    <>
      {/* 격자 규칙은 홈·검색(`PostList`)과 같다. 같은 카드라 같은 자리에서 갈라져야 한다. */}
      <ul
        className="flex flex-col divide-y divide-gray-100 md:grid md:grid-cols-2 md:gap-x-5
                   md:gap-y-6 md:divide-y-0 xl:grid-cols-3 dark:divide-gray-800"
      >
        {posts.map(function renderCard(post: MyPostSummary) {
          return (
            <PostCard
              key={post.id}
              post={post}
              now={now}
              timeText={toMyListTimeText(props.kind, post.sortAt, now)}
              action={props.renderAction?.(post, now)}
            />
          );
        })}

        {/* 다음 페이지를 부르는 표식. 목록의 일부가 아니라 관찰 대상일 뿐이다. */}
        <li ref={sentinelRef} aria-hidden="true" className="h-px md:col-span-full" />
      </ul>

      {query.isFetchingNextPage ? <p className={MESSAGE_CLASS}>더 불러오는 중입니다…</p> : null}
    </>
  );
}

export default MyPostList;
