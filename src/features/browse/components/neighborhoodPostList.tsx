import PostCard from './postCard';
import { useNeighborhoodPostsQuery } from '../../post/hooks/usePostQueries';
import type { PostSummary } from '../../post/types';

type NeighborhoodPostListProps = {
  /** 내 동네 법정동 코드. 아직 동네를 정하지 않았으면 null. */
  regionCode: string | null;
};

/**
 * 홈의 내 동네 최신 글 목록. 조건 없이 최근 20개만 보여준다.
 *
 * 검색·필터·무한 스크롤은 `/search`(searchPage)가 맡는다. 홈은 "지금 우리 동네에 뭐가 올라왔나"를
 * 한눈에 보는 자리라 조건을 걸 수단을 두지 않고 짧게 끊는다.
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
