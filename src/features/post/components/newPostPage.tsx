import { Link, Navigate, useNavigate } from 'react-router-dom';
import PostForm from './postForm';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useMyProfileQuery } from '../../profile/hooks/useProfileQuery';
import { useCreatePostMutation } from '../hooks/useCreatePostMutation';
import { toPostErrorMessage } from '../utils/postErrorMessage';
import { toNewImageFiles } from '../utils/validatePostInput';
import type { PostFormValues } from '../types';

/**
 * 글쓰기 화면.
 *
 * 로그인 확인을 여기서 한 번 더 한다 — RequireOnboarding은 게스트를 통과시키므로
 * (홈은 비로그인에게도 보여야 한다) 로그인 강제는 화면마다의 몫이다.
 */
function NewPostPage() {
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const profileQuery = useMyProfileQuery(user?.id ?? null);
  const createPostMutation = useCreatePostMutation();
  const navigate = useNavigate();

  const region = profileQuery.data?.region ?? null;

  function handleSubmit(values: PostFormValues): void {
    if (user === null || region === null || values.categoryId === null) {
      return;
    }

    createPostMutation.mutate(
      {
        sellerId: user.id,
        title: values.title.trim(),
        description: values.description.trim(),
        price: Number(values.price),
        categoryId: values.categoryId,
        // 등록 화면의 사진은 전부 새 파일이다. 기존 사진이 섞이는 것은 수정 화면뿐이다.
        imageFiles: toNewImageFiles(values.images),
        tradePlace: values.tradePlace,
        region,
      },
      {
        onSuccess: function goToCreatedPost(postId: number): void {
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

  if (profileQuery.isLoading) {
    return <PageSpinner message="프로필을 불러오는 중입니다…" />;
  }

  const errorMessage =
    createPostMutation.error !== null ? toPostErrorMessage(createPostMutation.error) : null;

  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">중고거래 글쓰기</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {region === null
            ? '동네를 먼저 설정해야 글을 올릴 수 있습니다.'
            : `${region.fullName} 이웃들에게 보입니다.`}
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

        {region === null ? (
          <Link
            to="/settings/region"
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm
                       font-semibold text-white transition hover:bg-emerald-700"
          >
            내 동네 설정하러 가기
          </Link>
        ) : (
          <PostForm
            mode="create"
            center={region.coords}
            isPending={createPostMutation.isPending}
            onSubmit={handleSubmit}
          />
        )}
      </section>
    </main>
  );
}

export default NewPostPage;
