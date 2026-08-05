import { Link, useParams } from 'react-router-dom';
import PostImageCarousel from './postImageCarousel';
import PostOwnerMenu from './postOwnerMenu';
import PostSellerCard from './postSellerCard';
import PostStatusBadge from './postStatusBadge';
import PostStatusControl from './postStatusControl';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { formatPrice } from '../../../shared/utils/formatPrice';
import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
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
      {/*
        같은 자리에 ⋯ 메뉴가 하나 붙는다. 내 글이면 관리(수정·끌올·삭제),
        남의 글이면 안전(신고·차단)이다. 둘이 함께 뜨는 일은 없다.
      */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="text-sm text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← 홈으로
        </Link>

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

      {/* 판매자에게는 상태 변경 패널이, 그 밖에는 찜·채팅 버튼이 온다. 높이가 달라 위로 맞춘다. */}
      <div className="flex flex-wrap items-start gap-2 pt-2">
        <PostActions post={post} viewerId={viewerId} />
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
      <CommentSection postId={post.id} viewerId={viewerId} sellerId={post.seller.id} />
    </main>
  );
}

export default PostDetailPage;
