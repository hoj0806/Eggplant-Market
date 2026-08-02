import { Link, useParams } from 'react-router-dom';
import PostImageCarousel from './postImageCarousel';
import PostSellerCard from './postSellerCard';
import PostStatusBadge from './postStatusBadge';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { formatPrice } from '../../../shared/utils/formatPrice';
import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import LikeButton from '../../like/components/likeButton';
import { usePostDetailQuery } from '../hooks/usePostQueries';
import { useViewCount } from '../hooks/useViewCount';
import type { PostDetail } from '../types';

/** 주소의 :postId는 문자열이다. 숫자가 아니면 없는 글로 본다. */
function toPostId(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null;
  }

  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function PostMeta(props: { post: PostDetail }) {
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      {props.post.categoryName !== null ? `${props.post.categoryName} · ` : ''}
      {formatTimeAgo(props.post.createdAt)} · 조회 {props.post.viewCount} · 찜{' '}
      {props.post.likeCount}
    </p>
  );
}

function TradePlaceSection(props: { post: PostDetail }) {
  if (props.post.tradePlace === null) {
    return null;
  }

  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">거래희망장소</h2>
      <p className="text-sm text-gray-700 dark:text-gray-300">{props.post.tradePlace.name}</p>
    </section>
  );
}

/**
 * 글 아래 버튼 자리.
 *
 * 자기 글에는 찜 버튼을 그리지 않는다 — 조회수와 같은 이유다.
 * 자기 글을 찜해 찜 개수를 올릴 수 있으면 "찜 많은 순" 정렬이 의미를 잃는다.
 * 서버도 같은 규칙을 들고 있다(0006의 likes_insert 정책).
 */
function PostActions(props: { post: PostDetail; viewerId: string | null }) {
  if (props.viewerId === null) {
    return (
      <Link
        to="/login"
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700
                   transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200
                   dark:hover:bg-gray-800"
      >
        로그인하고 찜하기
      </Link>
    );
  }

  if (props.viewerId === props.post.seller.id) {
    return (
      <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        내가 올린 상품이에요
      </span>
    );
  }

  return (
    <LikeButton
      postId={props.post.id}
      viewerId={props.viewerId}
      isLiked={props.post.isLiked}
      likeCount={props.post.likeCount}
    />
  );
}

function PostDetailPage() {
  const params = useParams();
  const postId = toPostId(params.postId);
  const user = useAuthStore(selectAuthUser);
  const viewerId = user?.id ?? null;

  const postQuery = usePostDetailQuery(postId, viewerId);
  useViewCount(postQuery.data, viewerId);

  if (postId === null || postQuery.isError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col items-center justify-center gap-3 p-6">
        <p className="text-gray-700 dark:text-gray-200">게시물을 찾을 수 없습니다.</p>
        <Link
          to="/"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          홈으로 가기
        </Link>
      </main>
    );
  }

  if (postQuery.isLoading || postQuery.data === undefined) {
    return <PageSpinner message="게시물을 불러오는 중입니다…" />;
  }

  const post = postQuery.data;

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-4 p-6">
      <Link
        to="/"
        className="text-sm text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        ← 홈으로
      </Link>

      <PostImageCarousel images={post.images} title={post.title} />

      <PostSellerCard seller={post.seller} dongName={post.dongName} />

      <section className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <PostStatusBadge status={post.status} />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{post.title}</h1>
        </div>
        <PostMeta post={post} />
        <p className="text-xl font-bold text-gray-900 dark:text-gray-50">
          {formatPrice(post.price)}
        </p>
      </section>

      {/* 줄바꿈을 그대로 살린다. 설명은 사용자가 쓴 대로 보여야 한다. */}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
        {post.description}
      </p>

      <TradePlaceSection post={post} />

      <div className="flex items-center gap-2 pt-2">
        <PostActions post={post} viewerId={viewerId} />
      </div>
    </main>
  );
}

export default PostDetailPage;
