import { Link } from 'react-router-dom';
import { formatPrice } from '../../../shared/utils/formatPrice';
import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
import PostStatusBadge from '../../post/components/postStatusBadge';
import type { ReactNode } from 'react';
import type { PostSummary } from '../../post/types';

type PostCardProps = {
  post: PostSummary;
  /** 목록 전체가 같은 기준으로 "n분 전"을 계산하도록 부모가 넘긴다. */
  now: Date;
  /**
   * 시간 자리에 대신 적을 문구.
   *
   * 홈·검색에서는 끌올 시각("3일 전")이 맞지만 마이페이지에서는 그 자리에
   * "3일 전 찜"·"7월 30일 구매"처럼 목록마다 다른 뜻이 온다. 넘기지 않으면 지금까지와 같다.
   */
  timeText?: string;
  /**
   * 카드 아래에 붙는 버튼 자리(판매관리의 끌어올리기).
   *
   * 링크 안이 아니라 밖에 둔다 — a 안에 button을 넣으면 어느 쪽이 눌린 것인지 브라우저마다
   * 다르게 굴고, 스크린리더도 링크 이름에 버튼 글자를 섞어 읽는다.
   */
  action?: ReactNode;
};

function PostCard(props: PostCardProps) {
  const post = props.post;
  const timeText = props.timeText ?? formatTimeAgo(post.bumpedAt, props.now);

  return (
    <li>
      <Link
        to={`/posts/${post.id}`}
        className="flex gap-3 rounded-xl p-2 transition hover:bg-gray-50 dark:hover:bg-gray-900"
      >
        {post.thumbnailUrl === null ? (
          <span
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-gray-100
                       text-xs text-gray-400 dark:bg-gray-800"
          >
            사진 없음
          </span>
        ) : (
          <img
            src={post.thumbnailUrl}
            alt={post.title}
            className="h-24 w-24 shrink-0 rounded-lg bg-gray-100 object-cover dark:bg-gray-800"
          />
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-start gap-2">
            {post.status === 'selling' ? null : <PostStatusBadge status={post.status} />}
            <span className="truncate font-medium text-gray-900 dark:text-gray-50">
              {post.title}
            </span>
          </div>

          <span className="text-xs text-gray-500 dark:text-gray-400">
            {post.dongName ?? '동네 정보 없음'} · {timeText}
          </span>

          <span className="font-semibold text-gray-900 dark:text-gray-50">
            {formatPrice(post.price)}
          </span>

          {post.likeCount > 0 || post.viewCount > 0 ? (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              찜 {post.likeCount} · 조회 {post.viewCount}
            </span>
          ) : null}
        </div>
      </Link>

      {props.action}
    </li>
  );
}

export default PostCard;
