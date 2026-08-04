import { Link, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import ReviewForm from './reviewForm';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { usePostDetailQuery } from '../../post/hooks/usePostQueries';
import { toPostId } from '../../post/utils/postId';
import { useCreateReviewMutation } from '../hooks/useCreateReviewMutation';
import { toReviewErrorMessage } from '../utils/reviewErrorMessage';
import { toReviewEligibility, type ReviewTarget } from '../utils/reviewTarget';
import type { ReviewFormValues } from '../types';

const BACK_LINK_CLASS =
  'text-sm text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';
const PRIMARY_LINK_CLASS =
  'rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700';

/** 돌아가는 길은 언제나 그 거래의 게시물이다 — 구매자로 왔든 판매자로 왔든 같은 자리다. */
function ReviewLayout(props: { postId: number; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-4 p-6">
      <Link to={`/posts/${props.postId}`} className={BACK_LINK_CLASS}>
        ← 거래한 물건
      </Link>
      {props.children}
    </main>
  );
}

/**
 * 폼과 저장을 맡는 안쪽.
 *
 * 훅(useCreateReviewMutation)이 후기를 받을 사람을 알아야 캐시를 무효화할 수 있는데,
 * 그 사람은 게시물을 읽어 봐야 정해진다. 훅은 조건부로 부를 수 없으니 자격이 확인된 뒤에
 * 그리는 컴포넌트로 한 겹 나눈다.
 */
function ReviewFormSection(props: { postId: number; postTitle: string; target: ReviewTarget }) {
  const reviewMutation = useCreateReviewMutation(props.postId, props.target.id);

  if (reviewMutation.isSuccess) {
    return (
      <section className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          후기를 남겼어요. 고마워요!
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {props.target.nickname}님의 매너온도에 반영됐어요.
        </p>
        <div className="flex gap-2">
          <Link to={`/users/${props.target.id}`} className={PRIMARY_LINK_CLASS}>
            {props.target.nickname}님 프로필 보기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">거래후기 남기기</h1>
        <p className="truncate text-sm text-gray-500 dark:text-gray-400">{props.postTitle}</p>
      </header>

      <ReviewForm
        targetNickname={props.target.nickname}
        isSubmitting={reviewMutation.isPending}
        errorMessage={
          reviewMutation.isError ? toReviewErrorMessage(reviewMutation.error) : null
        }
        onSubmit={function submitReview(values: ReviewFormValues): void {
          reviewMutation.mutate({
            rating: values.rating,
            mannerTags: values.mannerTags,
            comment: values.comment,
          });
        }}
      />
    </>
  );
}

/**
 * 거래후기 작성 — `/posts/:postId/review`.
 *
 * 게시물마다 하나뿐인 자리라 주소를 게시물 아래에 둔다. 구매내역·판매관리 목록과
 * 거래완료 직후 안내가 모두 여기로 온다.
 *
 * 누구에게 남기는 후기인지는 **주소에 없다.** 게시물의 반대편 당사자로 정해지고,
 * 그 판단은 서버가 한 번 더 한다(0013의 create_review). 화면은 같은 규칙으로 먼저 말해 줄 뿐이다.
 */
function ReviewWritePage() {
  const params = useParams();
  const postId = toPostId(params.postId);
  const viewer = useAuthStore(selectAuthUser);
  const viewerId = viewer?.id ?? null;

  const postQuery = usePostDetailQuery(postId, viewerId);

  if (postId === null || postQuery.isError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col items-center justify-center gap-3 p-6">
        <p className="text-gray-700 dark:text-gray-200">게시물을 찾을 수 없습니다.</p>
        <Link to="/" className={PRIMARY_LINK_CLASS}>
          홈으로 가기
        </Link>
      </main>
    );
  }

  if (postQuery.isLoading || postQuery.data === undefined) {
    return <PageSpinner message="거래 정보를 불러오는 중입니다…" />;
  }

  const post = postQuery.data;
  const eligibility = toReviewEligibility(post, viewerId);

  if (eligibility.kind === 'blocked') {
    return (
      <ReviewLayout postId={post.id}>
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-gray-700 dark:text-gray-200">{eligibility.reason}</p>
          <Link to="/my/purchases" className={PRIMARY_LINK_CLASS}>
            구매내역 보기
          </Link>
        </div>
      </ReviewLayout>
    );
  }

  return (
    <ReviewLayout postId={post.id}>
      <ReviewFormSection postId={post.id} postTitle={post.title} target={eligibility.target} />
    </ReviewLayout>
  );
}

export default ReviewWritePage;
