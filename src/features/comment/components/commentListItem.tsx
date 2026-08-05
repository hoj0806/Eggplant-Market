import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
import ProfileAvatar from '../../profile/components/profileAvatar';
import type { PostComment } from '../types';

type CommentListItemProps = {
  comment: PostComment;
  /** 목록 전체가 같은 기준으로 "n분 전"을 계산하도록 부모가 넘긴다(ReviewListItem과 같다). */
  now: Date;
  /** 이 댓글을 지울 수 있는가. 판단은 부모가 한다 — 게시물 판매자인지를 여기서는 모른다. */
  canDelete: boolean;
  isDeleting: boolean;
  onDelete(commentId: number): void;
};

/**
 * 댓글 한 줄.
 *
 * 판매자 표시를 붙이지 않는다. 붙이려면 게시물의 판매자 id를 여기까지 내려야 하는데,
 * 바로 위 `PostSellerCard`에 같은 이름과 사진이 이미 있어 같은 화면에서 두 번 알려 주는
 * 셈이 된다. 당근도 댓글에는 따로 표시하지 않는다.
 *
 * 삭제는 한 번 더 묻는다. 지운 댓글은 되돌릴 수 없고(0017에 update 화면이 없어 복구도 없다),
 * 목록에서 줄 간격이 좁아 잘못 누르기 쉽다 — postOwnerMenu의 삭제 확인과 같은 형태다.
 */
function CommentListItem(props: CommentListItemProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const comment = props.comment;

  function askDelete(): void {
    setIsConfirming(true);
  }

  function cancelDelete(): void {
    setIsConfirming(false);
  }

  function handleDelete(): void {
    props.onDelete(comment.id);
  }

  return (
    <li className="flex gap-3 py-3">
      <ProfileAvatar
        nickname={comment.author.nickname}
        avatarUrl={comment.author.avatarUrl}
        size="sm"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/users/${comment.author.id}`}
            className="truncate text-sm font-medium text-gray-900 transition hover:underline
                       dark:text-gray-50"
          >
            {comment.author.nickname}
          </Link>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatTimeAgo(comment.createdAt, props.now)}
          </span>
        </div>

        {/* 줄바꿈을 살린다. 게시물 설명과 같은 이유로, 쓴 대로 보여야 한다. */}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
          {comment.content}
        </p>

        {props.canDelete ? (
          <div className="flex items-center gap-2 pt-0.5">
            {isConfirming ? (
              <>
                <span className="text-xs text-gray-600 dark:text-gray-300">지울까요?</span>
                <button
                  type="button"
                  disabled={props.isDeleting}
                  onClick={handleDelete}
                  className="text-xs font-semibold text-red-600 transition hover:text-red-700
                             disabled:opacity-60 dark:text-red-400"
                >
                  {props.isDeleting ? '삭제 중…' : '삭제'}
                </button>
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="text-xs text-gray-500 transition hover:text-gray-700
                             dark:text-gray-400 dark:hover:text-gray-200"
                >
                  취소
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={askDelete}
                className="text-xs text-gray-500 transition hover:text-gray-700
                           dark:text-gray-400 dark:hover:text-gray-200"
              >
                삭제
              </button>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default CommentListItem;
