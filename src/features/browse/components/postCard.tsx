import { Link } from 'react-router-dom';
import { formatPrice } from '../../../shared/utils/formatPrice';
import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
import PostStatusBadge from '../../post/components/postStatusBadge';
import type { PostSummary } from '../../post/types';

type PostCardProps = {
  post: PostSummary;
  /** 목록 전체가 같은 기준으로 "n분 전"을 계산하도록 부모가 넘긴다. */
  now: Date;
};

function PostCard(props: PostCardProps) {
  const post = props.post;

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
            {post.dongName ?? '동네 정보 없음'} · {formatTimeAgo(post.bumpedAt, props.now)}
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
    </li>
  );
}

export default PostCard;
