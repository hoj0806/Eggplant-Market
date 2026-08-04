import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import PostForm from './postForm';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useMyProfileQuery } from '../../profile/hooks/useProfileQuery';
import { usePostDetailQuery } from '../hooks/usePostQueries';
import { useUpdatePostMutation } from '../hooks/useUpdatePostMutation';
import { toPostErrorMessage } from '../utils/postErrorMessage';
import { toPostId } from '../utils/postId';
import type { PostDetail, PostFormValues, PostImageItem } from '../types';

/**
 * 상세에서 읽은 글을 폼이 이해하는 모양으로 되돌린다.
 *
 * 이미 올라가 있는 사진은 파일이 아니라 주소로만 들고 있다 —
 * 고치지 않은 사진을 내려받아 다시 올릴 이유가 없다.
 */
function toFormValues(post: PostDetail): PostFormValues {
  return {
    title: post.title,
    description: post.description,
    price: String(post.price),
    categoryId: post.categoryId,
    images: post.images.map(function toExistingImage(url: string): PostImageItem {
      return { kind: 'existing', url };
    }),
    tradePlace: post.tradePlace,
  };
}

/**
 * 게시물 수정 화면.
 *
 * 폼은 등록과 같은 것을 쓴다(mode='edit'). 이 화면이 따로 하는 일은 셋뿐이다 —
 * 남의 글을 고치러 온 사람을 돌려보내고, 상세에서 읽은 값을 폼 모양으로 되돌리고,
 * 저장이 끝나면 상세로 돌아간다.
 *
 * 남의 글 차단은 서버도 하고 있다(posts_update의 `auth.uid() = seller_id`).
 * 여기서 막는 것은 고칠 수 없는 폼을 채우게 두지 않기 위해서다.
 */
function PostEditPage() {
  const params = useParams();
  const postId = toPostId(params.postId);
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const viewerId = user?.id ?? null;

  const postQuery = usePostDetailQuery(postId, viewerId);
  const profileQuery = useMyProfileQuery(viewerId);
  const updatePostMutation = useUpdatePostMutation(postId ?? 0, viewerId);
  const navigate = useNavigate();

  function handleSubmit(values: PostFormValues): void {
    if (viewerId === null || postId === null || values.categoryId === null) {
      return;
    }

    updatePostMutation.mutate(
      {
        sellerId: viewerId,
        title: values.title.trim(),
        description: values.description.trim(),
        price: Number(values.price),
        categoryId: values.categoryId,
        images: values.images,
        tradePlace: values.tradePlace,
      },
      {
        onSuccess: function goBackToPost(): void {
          navigate(`/posts/${postId}`, { replace: true });
        },
      },
    );
  }

  if (status === 'loading') {
    return <PageSpinner message="세션을 확인하는 중입니다…" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

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

  if (post.seller.id !== viewerId) {
    return <Navigate to={`/posts/${post.id}`} replace />;
  }

  // 거래희망장소 검색의 중심. 이미 고른 장소가 있으면 그 근처를, 없으면 내 동네를 본다.
  const center = post.tradePlace?.coords ?? profileQuery.data?.region?.coords ?? null;

  const errorMessage =
    updatePostMutation.error !== null ? toPostErrorMessage(updatePostMutation.error) : null;

  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <Link
          to={`/posts/${post.id}`}
          className="text-sm text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← 게시물로 돌아가기
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">중고거래 글 수정</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {post.dongName ?? '내 동네'} 이웃들에게 보입니다. 동네는 바뀌지 않아요.
        </p>
      </header>

      <section
        className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6
                   shadow-sm dark:border-gray-800 dark:bg-gray-950"
      >
        {errorMessage !== null ? (
          <p
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700
                       dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}

        <PostForm
          mode="edit"
          center={center}
          initialValues={toFormValues(post)}
          isPending={updatePostMutation.isPending}
          onSubmit={handleSubmit}
        />
      </section>
    </main>
  );
}

export default PostEditPage;
