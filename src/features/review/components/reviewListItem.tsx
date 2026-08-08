import { Link } from 'react-router-dom';
import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
import ProfileAvatar from '../../profile/components/profileAvatar';
import { REVIEW_RATING_ICON, REVIEW_RATING_LABEL } from '../utils/reviewRating';
import type { ReceivedReview } from '../types';

type ReviewListItemProps = {
  review: ReceivedReview;
  /** 목록 전체가 같은 기준으로 "n일 전"을 계산하도록 부모가 넘긴다. */
  now: Date;
};

const TAG_CLASS =
  'rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300';

/**
 * 받은 후기 한 건.
 *
 * 누가 썼는지를 맨 앞에 둔다 — 익명 후기는 근거가 되지 않는다. 쓴 사람 이름은 그 사람의
 * 프로필로 가는 링크다(당근에서 후기를 보고 상대를 되짚어 보는 동선이 그대로 있다).
 *
 * 점수는 어디에도 적지 않는다. 서버가 아예 내려보내지 않고(0013), 온도는 이미 프로필 머리말에
 * 녹아 있다. 여기서는 좋았는지 아닌지만 표식과 낱말로 보인다.
 */
function ReviewListItem(props: ReviewListItemProps) {
  const review = props.review;

  return (
    <li className="flex gap-3 py-4">
      <ProfileAvatar
        nickname={review.reviewerNickname}
        avatarUrl={review.reviewerAvatarUrl}
        size="sm"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/users/${review.reviewerId}`}
            className="truncate text-sm font-medium text-gray-900 transition hover:underline
                       dark:text-gray-50"
          >
            {review.reviewerNickname}
          </Link>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatTimeAgo(review.createdAt, props.now)}
          </span>
        </div>

        <span className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
          {(function renderRatingIcon() {
            const RatingIcon = REVIEW_RATING_ICON[review.rating];
            return <RatingIcon size={16} />;
          })()}
          {REVIEW_RATING_LABEL[review.rating]}
        </span>

        {review.mannerTags.length === 0 ? null : (
          <ul className="flex flex-wrap gap-1">
            {review.mannerTags.map(function renderTag(tag: string) {
              return (
                <li key={tag} className={TAG_CLASS}>
                  {tag}
                </li>
              );
            })}
          </ul>
        )}

        {review.comment === null ? null : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            {review.comment}
          </p>
        )}

        {/* 어떤 거래였는지. 글이 지워지면 후기도 함께 사라지므로(FK cascade) 링크가 비지 않는다. */}
        <Link
          to={`/posts/${review.postId}`}
          className="truncate text-xs text-gray-500 transition hover:text-gray-700
                     dark:text-gray-400 dark:hover:text-gray-200"
        >
          {review.postTitle}
        </Link>
      </div>
    </li>
  );
}

export default ReviewListItem;
