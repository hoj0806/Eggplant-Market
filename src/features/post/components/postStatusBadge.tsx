import type { PostStatus } from '../types';

type PostStatusBadgeProps = {
  status: PostStatus;
};

const LABEL_BY_STATUS: Record<PostStatus, string> = {
  selling: '판매중',
  reserved: '예약중',
  sold: '거래완료',
};

const CLASS_BY_STATUS: Record<PostStatus, string> = {
  selling: 'bg-emerald-600 text-white',
  reserved: 'bg-amber-500 text-white',
  sold: 'bg-gray-500 text-white',
};

/** 상태 변경 기능은 아직 없다. 지금은 모든 글이 판매중으로 등록된다. */
function PostStatusBadge(props: PostStatusBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
        CLASS_BY_STATUS[props.status]
      }`}
    >
      {LABEL_BY_STATUS[props.status]}
    </span>
  );
}

export default PostStatusBadge;
