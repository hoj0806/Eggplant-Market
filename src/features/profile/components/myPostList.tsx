import PostCard from '../../browse/components/postCard';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import { toMyListTimeText } from '../utils/myListTimeText';
import type { MyPostsQueryResult } from '../hooks/useMyPostsQuery';
import type { MyListKind, MyPostSummary } from '../types';

type MyPostListProps = {
  kind: MyListKind;
  query: MyPostsQueryResult;
  /** 목록이 비었을 때 보여줄 문구. 목록마다 할 말이 다르다. */
  emptyMessage: string;
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
  const now = new Date();

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
      <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {posts.map(function renderCard(post: MyPostSummary) {
          return (
            <PostCard
              key={post.id}
              post={post}
              now={now}
              timeText={toMyListTimeText(props.kind, post.sortAt, now)}
            />
          );
        })}

        {/* 다음 페이지를 부르는 표식. 목록의 일부가 아니라 관찰 대상일 뿐이다. */}
        <li ref={sentinelRef} aria-hidden="true" className="h-px" />
      </ul>

      {query.isFetchingNextPage ? <p className={MESSAGE_CLASS}>더 불러오는 중입니다…</p> : null}
    </>
  );
}

export default MyPostList;
