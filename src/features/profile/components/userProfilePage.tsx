import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import UserProfileCard from './userProfileCard';
import PageHeader from '../../../shared/ui/pageHeader';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import SafetyMenu from '../../block/components/safetyMenu';
import PostList from '../../browse/components/postList';
import ReviewList from '../../review/components/reviewList';
import { useUserReviewsQuery } from '../../review/hooks/useReviewQueries';
import { useUserPostsQuery, useUserProfileQuery } from '../hooks/useUserProfileQuery';
import type { MyPostSummary } from '../types';

/** 판매 상품과 받은 후기. 한 화면에 세로로 쌓으면 무한 스크롤 두 개가 서로를 밀어낸다. */
type UserProfileTab = 'posts' | 'reviews';

const TAB_BASE_CLASS =
  'rounded-full border px-3 py-1.5 text-sm font-medium transition whitespace-nowrap';
const TAB_SELECTED_CLASS = 'border-emerald-600 bg-emerald-600 text-white';
const TAB_UNSELECTED_CLASS =
  'border-gray-300 text-gray-700 hover:bg-gray-50 ' +
  'dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

/**
 * 다른 사용자의 프로필.
 *
 * 게시물 상세의 판매자 카드에서 들어오는 자리다. 여기까지 오는 이유는 하나뿐이다 —
 * **이 사람과 거래해도 되는지 판단하려고.** 그래서 매너온도·거래 횟수·받은 후기가 앞에 오고,
 * 팔고 있는 다른 물건이 뒤따른다.
 *
 * 로그인은 요구하지 않는다. 게시물 상세가 비로그인에게도 열려 있는데 판매자만 가려 두면
 * 물건은 보이는데 파는 사람은 볼 수 없는 이상한 자리가 된다(세 테이블 모두 공개 조회다).
 */
function UserProfilePage() {
  const params = useParams();
  const userId = params.userId ?? null;
  const viewer = useAuthStore(selectAuthUser);
  const [tab, setTab] = useState<UserProfileTab>('posts');

  const profileQuery = useUserProfileQuery(userId);
  const postsQuery = useUserPostsQuery(userId);

  // 받은 후기가 0건인 사람이 대부분이라, 있다고 머리말이 말해 줄 때만 목록을 부른다.
  const reviewCount = profileQuery.data?.reviewCount ?? 0;
  const reviewsQuery = useUserReviewsQuery(reviewCount > 0 ? userId : null);

  if (profileQuery.isError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col items-center justify-center gap-3 p-6">
        <p className="text-gray-700 dark:text-gray-200">사용자를 찾을 수 없습니다.</p>
        <Link
          to="/"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          홈으로 가기
        </Link>
      </main>
    );
  }

  if (profileQuery.isLoading || profileQuery.data === undefined) {
    return <PageSpinner message="프로필을 불러오는 중입니다…" />;
  }

  const profile = profileQuery.data;
  const isMe = viewer !== null && viewer.id === profile.id;
  const posts: MyPostSummary[] = (postsQuery.data?.pages ?? []).flat();

  function toTabClassName(value: UserProfileTab): string {
    return `${TAB_BASE_CLASS} ${tab === value ? TAB_SELECTED_CLASS : TAB_UNSELECTED_CLASS}`;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-4 p-6">
      {/* 제목은 아래 UserProfileCard가 사람 이름으로 대신한다. */}
      <PageHeader
        backTo="/"
        backLabel="홈"
        action={
          /* 내 프로필을 남이 보는 대로 볼 수도 있다. 고치는 자리는 마이페이지다. */
          isMe ? (
            <Link
              to="/my"
              className="text-sm text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
            >
              내 프로필 관리
            </Link>
          ) : (
            // 게시물이 없는 자리라 신고 대상은 사람뿐이다. 게스트에게는 스스로 그리지 않는다.
            <SafetyMenu
              viewerId={viewer?.id ?? null}
              targetUserId={profile.id}
              targetNickname={profile.nickname}
            />
          )
        }
      />

      <UserProfileCard profile={profile} />

      <div role="group" aria-label="프로필 탭" className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          aria-pressed={tab === 'posts'}
          onClick={function selectPosts(): void {
            setTab('posts');
          }}
          className={toTabClassName('posts')}
        >
          판매 상품 {profile.sellingCount}
        </button>
        <button
          type="button"
          aria-pressed={tab === 'reviews'}
          onClick={function selectReviews(): void {
            setTab('reviews');
          }}
          className={toTabClassName('reviews')}
        >
          받은 후기 {profile.reviewCount}
        </button>
      </div>

      {tab === 'posts' ? (
        <PostList
          posts={posts}
          isLoading={postsQuery.isLoading}
          isError={postsQuery.isError}
          // 거를 조건이 없는 목록이다. 0건이면 언제나 "파는 물건이 없다"는 뜻이다.
          isNarrowed={false}
          emptyMessage={`${profile.nickname}님이 판매중인 물건이 없어요.`}
          hasNextPage={postsQuery.hasNextPage}
          isFetchingNextPage={postsQuery.isFetchingNextPage}
          onLoadMore={function loadMorePosts(): void {
            void postsQuery.fetchNextPage();
          }}
        />
      ) : (
        <ReviewList
          query={reviewsQuery}
          emptyMessage={`아직 ${profile.nickname}님이 받은 후기가 없어요.`}
        />
      )}
    </main>
  );
}

export default UserProfilePage;
