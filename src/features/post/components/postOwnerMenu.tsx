import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBumpPostMutation } from '../hooks/useBumpPostMutation';
import { useDeletePostMutation } from '../hooks/useDeletePostMutation';
import { canBumpPost, toBumpRemainingText } from '../utils/postBumpCooldown';
import { toPostActionErrorMessage } from '../utils/postErrorMessage';
import type { PostDetail } from '../types';

type PostOwnerMenuProps = {
  post: PostDetail;
  viewerId: string;
};

const MENU_ITEM_CLASS =
  'w-full px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-800';

/**
 * 판매자만 보는 ⋯ 메뉴. 수정 · 끌어올리기 · 삭제가 여기 모인다.
 *
 * 거래 상태 변경(PostStatusControl)은 이 메뉴에 넣지 않았다. 상태는 상품을 볼 때마다 바로
 * 보여야 하는 정보이자 가장 자주 누르는 버튼이라 접어 두면 손해다. 당근도 같은 배치다.
 *
 * 삭제는 되돌릴 수 없어 한 번 더 묻는다 — 거래완료 확인(postStatusControl)과 같은 형태다.
 * 다만 그쪽은 "되돌릴 수 없다"는 경고고 이쪽은 딸린 것들(찜·채팅)까지 함께 사라진다는 안내다.
 */
function PostOwnerMenu(props: PostOwnerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const navigate = useNavigate();

  const bumpMutation = useBumpPostMutation(props.post.id, props.viewerId);
  const deleteMutation = useDeletePostMutation(props.post.id, props.viewerId);

  // 메뉴를 여는 순간을 기준으로 남은 시간을 잰다. 열어 둔 채로 시간이 흘러도 다시 그리지는 않는다 —
  // 어긋나 봐야 몇 분이고, 서버가 한 번 더 본다.
  const now = new Date();
  const canBump = canBumpPost(props.post.status, props.post.bumpedAt, now);
  const bumpRemainingText = toBumpRemainingText(props.post.bumpedAt, now);

  function handleToggle(): void {
    setIsOpen(function toggle(previous: boolean): boolean {
      return !previous;
    });
    setIsConfirmingDelete(false);
  }

  function handleBump(): void {
    bumpMutation.mutate(undefined, {
      onSuccess: function closeMenu(): void {
        setIsOpen(false);
      },
    });
  }

  function handleDelete(): void {
    deleteMutation.mutate(undefined, {
      onSuccess: function leavePost(): void {
        // 지워진 글의 주소에 남아 있으면 곧바로 "게시물을 찾을 수 없습니다"를 보게 된다.
        // replace라 뒤로 가기로도 그 자리에 돌아가지 않는다.
        navigate('/my/sales', { replace: true });
      },
    });
  }

  const isPending = bumpMutation.isPending || deleteMutation.isPending;
  const error = bumpMutation.error ?? deleteMutation.error;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="게시물 관리"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-gray-500
                   transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        ⋯
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-10 z-10 w-56 overflow-hidden rounded-xl border
                     border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-950"
        >
          <Link to={`/posts/${props.post.id}/edit`} className={MENU_ITEM_CLASS + ' block'}>
            게시물 수정
          </Link>

          <button
            type="button"
            disabled={!canBump || isPending}
            onClick={handleBump}
            className={MENU_ITEM_CLASS}
          >
            끌어올리기
          </button>

          {/* 왜 눌러지지 않는지 적어 준다. 회색 버튼만 있으면 고장으로 읽힌다. */}
          {canBump ? null : (
            <p className="px-4 pb-2 text-xs text-gray-500 dark:text-gray-400">
              {props.post.status === 'selling'
                ? (bumpRemainingText ?? '지금은 끌어올릴 수 없어요')
                : '판매중인 글만 끌어올릴 수 있어요'}
            </p>
          )}

          {isConfirmingDelete ? (
            <div className="flex flex-col gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
              <p className="text-xs text-gray-600 dark:text-gray-300">
                삭제하면 되돌릴 수 없어요. 이 글의 채팅과 찜도 함께 사라집니다.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleDelete}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white
                             transition hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteMutation.isPending ? '삭제 중…' : '삭제하기'}
                </button>
                <button
                  type="button"
                  onClick={function cancelDelete(): void {
                    setIsConfirmingDelete(false);
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs text-gray-600 transition
                             hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={function askDelete(): void {
                setIsConfirmingDelete(true);
              }}
              className={MENU_ITEM_CLASS + ' text-red-600 dark:text-red-400'}
            >
              게시물 삭제
            </button>
          )}

          {error !== null ? (
            <p role="alert" className="px-4 py-2 text-xs text-red-600 dark:text-red-400">
              {toPostActionErrorMessage(error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default PostOwnerMenu;
