import { Link, useParams } from 'react-router-dom';
import PostImageCarousel from './postImageCarousel';
import PostOwnerMenu from './postOwnerMenu';
import PostShareButton from './postShareButton';
import PostSellerCard from './postSellerCard';
import PostStatusBadge from './postStatusBadge';
import PostStatusControl from './postStatusControl';
import PageHeader from '../../../shared/ui/pageHeader';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { formatPrice } from '../../../shared/utils/formatPrice';
import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
import { isEdited } from '../../../shared/utils/isEdited';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import SafetyMenu from '../../block/components/safetyMenu';
import StartChatButton from '../../chat/components/startChatButton';
import CommentSection from '../../comment/components/commentSection';
import LikeButton from '../../like/components/likeButton';
import ReviewPrompt from '../../review/components/reviewPrompt';
import { usePostDetailQuery } from '../hooks/usePostQueries';
import { useRecordRecentView } from '../hooks/useRecordRecentView';
import { useViewCount } from '../hooks/useViewCount';
import { toPostId } from '../utils/postId';
import type { PostDetail } from '../types';

/**
 * 카테고리 · 올린 때 · 수정됨 · 조회 · 찜.
 *
 * "수정됨"은 **올린 때 바로 뒤**에 붙인다. 그 자리가 시각에 대한 단서를 읽는 자리라
 * 조회수·찜 사이에 끼우면 숫자를 세는 눈에 걸리지 않는다.
 *
 * 언제 고쳤는지는 적지 않는다. 읽는 사람에게 필요한 것은 "지금 보는 내용이 처음 올린 그대로냐"이지
 * 고친 시각이 아니고, 시각이 둘 붙으면 어느 쪽이 글의 나이인지 헷갈린다.
 */
function PostMeta(props: { post: PostDetail }) {
  const post = props.post;

  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      {post.categoryName !== null ? `${post.categoryName} · ` : ''}
      {formatTimeAgo(post.createdAt)}
      {isEdited(post.createdAt, post.updatedAt) ? ' · 수정됨' : ''} · 조회 {post.viewCount} · 찜{' '}
      {post.likeCount}
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
 * 자기 글에는 찜 버튼도 채팅 버튼도 그리지 않는다 — 조회수와 같은 이유다.
 * 자기 글을 찜해 찜 개수를 올릴 수 있으면 "찜 많은 순" 정렬이 의미를 잃고,
 * 자기 자신과 나누는 대화는 성립하지 않는다.
 * 서버도 같은 규칙을 들고 있다(0006의 likes_insert, 0008의 chat_rooms_insert 정책).
 *
 * 대신 판매자에게는 그 자리에 거래 상태를 바꾸는 버튼이 온다.
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
        로그인하고 채팅하기
      </Link>
    );
  }

  if (props.viewerId === props.post.seller.id) {
    return (
      <PostStatusControl
        postId={props.post.id}
        status={props.post.status}
        buyer={props.post.buyer}
        viewerId={props.viewerId}
      />
    );
  }

  return (
    <>
      <LikeButton
        postId={props.post.id}
        viewerId={props.viewerId}
        isLiked={props.post.isLiked}
        likeCount={props.post.likeCount}
      />
      <StartChatButton postId={props.post.id} />
    </>
  );
}

function PostDetailPage() {
  const params = useParams();
  const postId = toPostId(params.postId);
  const user = useAuthStore(selectAuthUser);
  const viewerId = user?.id ?? null;

  const postQuery = usePostDetailQuery(postId, viewerId);
  useViewCount(postQuery.data, viewerId);
  useRecordRecentView(postQuery.data?.id, viewerId);

  if (postId === null || postQuery.isError) {
    return (
      <main className="flex min-h-screen page-detail flex-col items-center justify-center gap-3 p-6">
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
    <main className="flex min-h-screen page-detail flex-col gap-4 p-6">
      {/*
        제목을 주지 않는다 — 이 화면의 제목 자리에는 사진과 글이 곧바로 온다.
        오른쪽에는 공유 버튼과 ⋯ 메뉴가 붙는다. ⋯는 내 글이면 관리(수정·끌올·삭제),
        남의 글이면 안전(신고·차단)이고 둘이 함께 뜨는 일은 없다.
        공유는 그 갈래 밖이다 — 내 글이든 남의 글이든, 로그인했든 아니든 같다.
      */}
      <PageHeader
        backTo="/"
        backLabel="홈"
        action={
          <div className="flex items-start gap-1">
            {/* 공유는 **로그인을 묻지 않는다.** 우리 서버에 아무것도 쓰지 않고,
                누구에게 보낼지는 카카오톡에서 고른다. 그래서 ⋯ 메뉴 밖에 둔다 —
                저쪽은 내 글이냐 남의 글이냐로 갈리지만 공유는 양쪽에서 같다. */}
            <PostShareButton post={post} />

            {viewerId !== null && viewerId === post.seller.id ? (
              <PostOwnerMenu post={post} viewerId={viewerId} />
            ) : (
              <SafetyMenu
                viewerId={viewerId}
                targetUserId={post.seller.id}
                targetNickname={post.seller.nickname}
                // 게시물 상세에서만 글 자체를 신고할 수 있다. 프로필·채팅방에는 신고할 글이 없다.
                post={{ id: post.id, title: post.title }}
              />
            )}
          </div>
        }
      />

      {/*
        `lg`부터 2단이다. 모바일에서는 사진 → 판매자 → 값 → 설명 → 버튼을 **위에서 아래로**
        훑지만, 데스크탑에서 그 순서를 그대로 세우면 사진이 화면을 가득 채우고 값과 버튼이
        스크롤 아래로 밀린다 — **살지 말지 정하는 데 필요한 것이 한눈에 안 들어온다.**

        왼쪽은 사진 하나로 두고(가장 넓은 자리를 차지할 값어치가 있다), 오른쪽에 판매자·제목·
        가격·설명·거래장소·버튼을 모은다. `items-start`가 있어야 짧은 쪽이 늘어나지 않는다.

        `lg:sticky`로 왼쪽 사진을 붙여 두면 오른쪽 설명이 길어도 사진이 따라온다.
        `top-16`은 상단 내비게이션(약 60px) 밑에 걸리지 않게 하는 값이다.

        댓글은 이 안에 넣지 않는다 — 아래 참고.
      */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-16">
          <PostImageCarousel images={post.images} title={post.title} />
        </div>

        <div className="flex flex-col gap-4">
          <PostSellerCard seller={post.seller} dongName={post.dongName} />

          <section className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <PostStatusBadge status={post.status} />
              <h1 className="text-lg font-semibold text-gray-900 lg:text-2xl dark:text-gray-50">
                {post.title}
              </h1>
            </div>
            <PostMeta post={post} />
            <p className="text-xl font-bold text-gray-900 lg:text-2xl dark:text-gray-50">
              {formatPrice(post.price)}
            </p>
          </section>

          {/* 줄바꿈을 그대로 살린다. 설명은 사용자가 쓴 대로 보여야 한다. */}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            {post.description}
          </p>

          <TradePlaceSection post={post} />

          {/* 판매자에게는 상태 변경 패널이, 그 밖에는 찜·채팅 버튼이 온다. 높이가 달라 위로 맞춘다. */}
          <div className="flex flex-wrap items-start gap-2 pt-2">
            <PostActions post={post} viewerId={viewerId} />
          </div>
        </div>
      </div>

      {/*
        거래가 끝났고 아직 후기를 안 남겼을 때만 스스로를 그린다.
        판매자·구매자 모두 여기서 같은 안내를 만난다 — 조건 판단은 전부 안에 있다.
      */}
      <ReviewPrompt postId={post.id} viewerId={viewerId} />

      {/*
        댓글은 맨 아래다. 글을 읽고 나서 묻는 자리이고, 위로 올리면 물건 정보와 버튼 사이를
        가른다. 후기 안내(ReviewPrompt)보다도 아래인 것은 그쪽이 거래 당사자에게만
        잠깐 떴다 사라지는 안내여서다.
      */}
      {/*
        2단 **밖**이다. 댓글은 물건을 다 본 뒤에 읽는 대화라 오른쪽 칸에 끼워 넣으면
        가격·버튼과 자리를 다투고, 왼쪽 사진과 높이가 어긋난다.
        대신 `lg:max-w-2xl`로 폭을 좁힌다 — 대화는 한 줄이 길어지면 읽기 나빠진다.
      */}
      <div className="lg:max-w-2xl">
        <CommentSection
          postId={post.id}
          commentCount={post.commentCount}
          viewerId={viewerId}
          sellerId={post.seller.id}
        />
      </div>
    </main>
  );
}

export default PostDetailPage;
