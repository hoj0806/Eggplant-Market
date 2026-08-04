import ReviewListItem from './reviewListItem';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import type { UserReviewsQueryResult } from '../hooks/useReviewQueries';
import type { ReceivedReview } from '../types';

type ReviewListProps = {
  query: UserReviewsQueryResult;
  emptyMessage: string;
};

const MESSAGE_CLASS = 'py-8 text-center text-sm text-gray-500 dark:text-gray-400';

/**
 * 받은 후기 목록.
 *
 * 로딩·오류·0건·무한스크롤을 다루는 방식은 게시물 목록(MyPostList·PostList)과 같다.
 * 한 화면에 두 목록(판매중 글·받은 후기)이 나란히 놓이므로 굴러가는 모양이 같아야 한다.
 */
function ReviewList(props: ReviewListProps) {
  const query = props.query;

  const sentinelRef = useInfiniteScroll({
    hasNextPage: query.hasNextPage,
    isFetching: query.isFetchingNextPage,
    onLoadMore: function loadMore(): void {
      query.fetchNextPage();
    },
  });

  // 항목마다 new Date()를 부르면 같은 목록에서 기준 시각이 어긋난다.
  const now = new Date();

  if (query.isLoading) {
    return <p className={MESSAGE_CLASS}>후기를 불러오는 중입니다…</p>;
  }

  if (query.isError) {
    return (
      <p role="alert" className="py-8 text-center text-sm text-red-600 dark:text-red-400">
        후기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  const reviews = (query.data?.pages ?? []).flat();

  if (reviews.length === 0) {
    return <p className={MESSAGE_CLASS}>{props.emptyMessage}</p>;
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {reviews.map(function renderReview(review: ReceivedReview) {
          return <ReviewListItem key={review.id} review={review} now={now} />;
        })}

        {/* 다음 페이지를 부르는 표식. 목록의 일부가 아니라 관찰 대상일 뿐이다. */}
        <li ref={sentinelRef} aria-hidden="true" className="h-px" />
      </ul>

      {query.isFetchingNextPage ? <p className={MESSAGE_CLASS}>더 불러오는 중입니다…</p> : null}
    </>
  );
}

export default ReviewList;
