import PostList from './postList';
import { useNeighborhoodPostsQuery } from '../../post/hooks/usePostQueries';
import type { PostSummary } from '../../post/types';

type NeighborhoodPostListProps = {
  /** 내 동네 법정동 코드. 아직 동네를 정하지 않았으면 null. */
  regionCode: string | null;
};

/**
 * 홈의 내 동네 글 목록. 최신순으로 끝까지 내려간다.
 *
 * 예전에는 20개에서 잘라 두고 "더 보고 싶으면 검색으로 가라"고 했는데, 21번째 글에 닿는 길이
 * 사실상 없었다. 검색은 찾을 물건이 정해졌을 때 쓰는 화면이고 홈은 훑는 화면이라,
 * 훑다가 끊기면 그 아래 글은 아무도 보지 않는다.
 *
 * 정렬 선택은 두지 않았다. 홈은 "지금 우리 동네에 뭐가 올라왔나"를 보는 자리라 최신순이 전제다.
 * 순서를 고르고 싶은 순간에는 이미 찾는 것이 있는 것이므로 검색(`/search`)이 그쪽을 맡는다.
 */
function NeighborhoodPostList(props: NeighborhoodPostListProps) {
  const postsQuery = useNeighborhoodPostsQuery(props.regionCode);

  function handleLoadMore(): void {
    void postsQuery.fetchNextPage();
  }

  if (props.regionCode === null) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        동네를 설정하면 우리 동네 중고거래 글을 볼 수 있어요.
      </p>
    );
  }

  // 페이지 단위로 쌓인 결과를 카드 목록 하나로 편다.
  const posts: PostSummary[] = (postsQuery.data?.pages ?? []).flat();

  return (
    <PostList
      posts={posts}
      isLoading={postsQuery.isLoading}
      isError={postsQuery.isError}
      // 홈에는 걸 수 있는 조건이 없다. 0건이면 언제나 "동네에 글이 없다"는 뜻이다.
      isNarrowed={false}
      hasNextPage={postsQuery.hasNextPage}
      isFetchingNextPage={postsQuery.isFetchingNextPage}
      onLoadMore={handleLoadMore}
    />
  );
}

export default NeighborhoodPostList;
