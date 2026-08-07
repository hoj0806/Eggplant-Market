import PostCard from './postCard';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import { useNow } from '../../../shared/hooks/useNow';
import type { PostSummary } from '../../post/types';

type PostListProps = {
  posts: PostSummary[];
  isLoading: boolean;
  isError: boolean;
  /** 검색어나 필터가 하나라도 걸려 있는가. 결과가 0건일 때 안내 문구가 달라진다. */
  isNarrowed: boolean;
  /**
   * 0건일 때 대신 적을 문구.
   *
   * 홈·검색은 "우리 동네"를 전제로 말하지만 남의 프로필에서는 그 말이 맞지 않는다.
   * 넘기지 않으면 지금까지와 같다.
   */
  emptyMessage?: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore(): void;
};

const MESSAGE_CLASS = 'py-8 text-center text-sm text-gray-500 dark:text-gray-400';

/**
 * 게시물 목록. 홈과 검색이 함께 쓴다.
 *
 * 데이터는 모두 부모가 가져온다. 이 컴포넌트는 "받은 것을 어떻게 보여줄지"만 안다.
 * 마지막 항목 뒤의 표식이 화면에 들어오면 다음 페이지를 부른다.
 *
 * 두 화면이 같은 껍데기를 쓰는 이유는 목록이 같은 RPC(search_posts)에서 같은 모양으로
 * 내려오기 때문이다. 로딩·오류·0건·무한스크롤을 각자 그리면 한쪽만 고쳐진 채로 어긋난다.
 */
function PostList(props: PostListProps) {
  const sentinelRef = useInfiniteScroll({
    hasNextPage: props.hasNextPage,
    isFetching: props.isFetchingNextPage,
    onLoadMore: props.onLoadMore,
  });

  // 카드마다 new Date()를 부르면 같은 목록에서 기준 시각이 어긋난다.
  // 스스로 흐르므로 목록을 열어 둔 채로도 "3분 전"이 멈추지 않는다.
  const now = useNow();

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
        {props.emptyMessage ??
          (props.isNarrowed
            ? '조건에 맞는 물건이 없어요. 검색어나 필터를 바꿔 보세요.'
            : '아직 우리 동네에 올라온 물건이 없어요. 첫 글을 올려 보세요.')}
      </p>
    );
  }

  return (
    <>
      {/*
        모바일은 줄 목록, 데스크탑은 격자다.
        `divide-y`는 줄 목록일 때만 뜻이 있어 격자에서 걷어낸다(`md:divide-y-0`) —
        안 걷어내면 칸 사이에 가로선이 어긋나게 그어진다.

        열 수를 `md` 2 · `xl` 3으로 둔 것은 카드 폭 때문이다. `page-wide`가 `lg`에서
        1152px까지 벌어지는데 거기서 4열로 나누면 카드가 260px 밑으로 좁아져
        제목이 대부분 잘린다. 격자는 "몇 개가 들어가나"가 아니라 **한 칸이 읽히나**로 정한다.

        마지막의 표식은 격자에서 한 칸을 차지하면 안 된다 — 빈 칸이 하나 생겨 마지막 줄이
        어긋난다. `md:col-span-full`로 한 줄을 통째로 쓰게 두면 높이 1px짜리 띠로만 남는다.
      */}
      <ul
        className="flex flex-col divide-y divide-gray-100 md:grid md:grid-cols-2 md:gap-x-5
                   md:gap-y-6 md:divide-y-0 xl:grid-cols-3 dark:divide-gray-800"
      >
        {props.posts.map(function renderCard(post: PostSummary) {
          return <PostCard key={post.id} post={post} now={now} />;
        })}

        {/* 다음 페이지를 부르는 표식. 목록의 일부가 아니라 관찰 대상일 뿐이다. */}
        <li ref={sentinelRef} aria-hidden="true" className="h-px md:col-span-full" />
      </ul>

      {props.isFetchingNextPage ? <p className={MESSAGE_CLASS}>더 불러오는 중입니다…</p> : null}
    </>
  );
}

export default PostList;
