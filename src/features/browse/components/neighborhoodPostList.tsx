import PostCard from './postCard';
import { useNeighborhoodPostsQuery } from '../../post/hooks/usePostQueries';
import type { PostSummary } from '../../post/types';

type NeighborhoodPostListProps = {
  /** 내 동네 법정동 코드. 아직 동네를 정하지 않았으면 null. */
  regionCode: string | null;
};

/**
 * 내 동네 최신 글 목록.
 *
 * 검색·카테고리 필터·무한 스크롤은 아직 없다(feature.md 2.2). 지금은 방금 올린 글이
 * 이웃에게 보이는지 확인할 수 있는 최소한의 목록이다.
 */
function NeighborhoodPostList(props: NeighborhoodPostListProps) {
  const postsQuery = useNeighborhoodPostsQuery(props.regionCode);
  // 카드마다 new Date()를 부르면 같은 목록에서 기준 시각이 어긋난다.
  const now = new Date();

  if (props.regionCode === null) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        동네를 설정하면 우리 동네 중고거래 글을 볼 수 있어요.
      </p>
    );
  }

  if (postsQuery.isLoading) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        게시물을 불러오는 중입니다…
      </p>
    );
  }

  if (postsQuery.isError) {
    return (
      <p role="alert" className="py-8 text-center text-sm text-red-600 dark:text-red-400">
        게시물을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  const posts = postsQuery.data ?? [];

  if (posts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        아직 우리 동네에 올라온 물건이 없어요. 첫 글을 올려 보세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
      {posts.map(function renderCard(post: PostSummary) {
        return <PostCard key={post.id} post={post} now={now} />;
      })}
    </ul>
  );
}

export default NeighborhoodPostList;
