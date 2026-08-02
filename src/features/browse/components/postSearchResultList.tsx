import PostCard from './postCard';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import type { PostSummary } from '../../post/types';

type PostSearchResultListProps = {
  posts: PostSummary[];
  isLoading: boolean;
  isError: boolean;
  /** 검색어나 필터가 하나라도 걸려 있는가. 결과가 0건일 때 안내 문구가 달라진다. */
  isNarrowed: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore(): void;
};

const MESSAGE_CLASS = 'py-8 text-center text-sm text-gray-500 dark:text-gray-400';

/**
 * 검색 결과 목록.
 *
 * 데이터는 모두 부모가 가져온다. 이 컴포넌트는 "받은 것을 어떻게 보여줄지"만 안다.
 * 마지막 항목 뒤의 표식이 화면에 들어오면 다음 페이지를 부른다.
 */
function PostSearchResultList(props: PostSearchResultListProps) {
  const sentinelRef = useInfiniteScroll({
    hasNextPage: props.hasNextPage,
    isFetching: props.isFetchingNextPage,
    onLoadMore: props.onLoadMore,
  });

  // 카드마다 new Date()를 부르면 같은 목록에서 기준 시각이 어긋난다.
  const now = new Date();

  if (props.isLoading) {
    return <p className={MESSAGE_CLASS}>게시물을 불러오는 중입니다…</p>;
  }

  if (props.isError) {
    return (
      <p role="alert" className="py-8 text-center text-sm text-red-600 dark:text-red-400">
        게시물을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  if (props.posts.length === 0) {
    return (
      <p className={MESSAGE_CLASS}>
        {props.isNarrowed
          ? '조건에 맞는 물건이 없어요. 검색어나 필터를 바꿔 보세요.'
          : '아직 우리 동네에 올라온 물건이 없어요. 첫 글을 올려 보세요.'}
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {props.posts.map(function renderCard(post: PostSummary) {
          return <PostCard key={post.id} post={post} now={now} />;
        })}

        {/* 다음 페이지를 부르는 표식. 목록의 일부가 아니라 관찰 대상일 뿐이다. */}
        <li ref={sentinelRef} aria-hidden="true" className="h-px" />
      </ul>

      {props.isFetchingNextPage ? <p className={MESSAGE_CLASS}>더 불러오는 중입니다…</p> : null}
    </>
  );
}

export default PostSearchResultList;
