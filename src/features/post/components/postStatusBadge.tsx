import { POST_STATUS_LABEL } from '../utils/postStatusTransition';
import type { PostStatus } from '../types';

type PostStatusBadgeProps = {
  status: PostStatus;
};

const CLASS_BY_STATUS: Record<PostStatus, string> = {
  selling: 'bg-emerald-600 text-white',
  reserved: 'bg-amber-500 text-white',
  sold: 'bg-gray-500 text-white',
};

/** 상태를 바꾸는 곳은 PostStatusControl이다. 여기는 보여 주기만 한다. */
function PostStatusBadge(props: PostStatusBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
        CLASS_BY_STATUS[props.status]
      }`}
    >
      {POST_STATUS_LABEL[props.status]}
    </span>
  );
}

export default PostStatusBadge;
