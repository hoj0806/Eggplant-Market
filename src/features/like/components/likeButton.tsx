import { useToggleLikeMutation } from '../hooks/useToggleLikeMutation';

type LikeButtonProps = {
  postId: number;
  viewerId: string;
  isLiked: boolean;
  likeCount: number;
};

/**
 * 찜 버튼. 로그인한 사용자만 볼 수 있다 —
 * 비로그인 안내는 게시물 상세가 로그인 링크로 대신 보여 준다.
 */
function LikeButton(props: LikeButtonProps) {
  const toggleLikeMutation = useToggleLikeMutation(props.postId, props.viewerId);

  function handleClick(): void {
    toggleLikeMutation.mutate({ isLiked: props.isLiked });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={props.isLiked}
      aria-label={props.isLiked ? '찜 해제' : '찜하기'}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium
                  transition disabled:opacity-60 ${
                    props.isLiked
                      ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                  }`}
    >
      <span aria-hidden="true">{props.isLiked ? '♥' : '♡'}</span>
      <span>{props.likeCount}</span>
    </button>
  );
}

export default LikeButton;
