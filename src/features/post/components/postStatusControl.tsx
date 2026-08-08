import { useState } from 'react';
import TradePartnerPicker from '../../chat/components/tradePartnerPicker';
import { useUpdatePostStatusMutation } from '../hooks/useUpdatePostStatusMutation';
import { toPostActionErrorMessage } from '../utils/postErrorMessage';
import {
  canChangePostStatus,
  needsTradePartner,
  POST_STATUS_LABEL,
  POST_STATUS_ORDER,
} from '../utils/postStatusTransition';
import type { PostChatPartner } from '../../chat/types';
import type { PostBuyer, PostStatus } from '../types';

type PostStatusControlProps = {
  postId: number;
  status: PostStatus;
  /** 지금 지정돼 있는 예약자·구매자. 없으면 null. */
  buyer: PostBuyer | null;
  viewerId: string;
  /** 채팅방에서 열었다면 그 방 상대를 미리 골라 둔다. */
  defaultPartnerId?: string | null;
};

const BUTTON_CLASS =
  'rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-40';

/**
 * 판매자가 거래 상태를 바꾸는 자리.
 *
 * 당근과 같은 흐름이다 — 예약중·거래완료를 고르면 곧바로 "누구와?"를 묻고,
 * 판매중으로 되돌릴 때는 묻지 않는다(예약자는 서버가 지운다).
 *
 * 거래완료는 되돌릴 수 없어서 한 번 더 확인한다. 규칙 자체는 서버가 들고 있고
 * (0008의 전이 트리거), 여기서는 같은 규칙으로 버튼을 잠글 뿐이다.
 */
function PostStatusControl(props: PostStatusControlProps) {
  const [pendingStatus, setPendingStatus] = useState<PostStatus | null>(null);
  const [confirmingSold, setConfirmingSold] = useState(false);
  // 방금 고른 상대. 채팅방에서는 부모가 buyer를 모르기 때문에(요약만 본다) 이 값이 유일한 근거다.
  const [chosenPartner, setChosenPartner] = useState<PostBuyer | null>(null);
  const statusMutation = useUpdatePostStatusMutation(props.postId, props.viewerId);

  const buyer = chosenPartner ?? props.buyer;

  function applyStatus(status: PostStatus, partner: PostBuyer | null): void {
    statusMutation.mutate(
      { status, buyerId: partner?.id ?? null },
      {
        onSuccess: function closePicker(): void {
          setPendingStatus(null);
          setConfirmingSold(false);
          setChosenPartner(partner);
        },
      },
    );
  }

  function handleSelect(status: PostStatus): void {
    if (status === 'sold' && !confirmingSold) {
      setConfirmingSold(true);
      return;
    }

    if (needsTradePartner(status)) {
      setPendingStatus(status);
      return;
    }

    applyStatus(status, null);
  }

  if (props.status === 'sold') {
    return (
      <div className="flex flex-col gap-1">
        <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          거래완료된 상품이에요
        </span>
        {buyer === null ? null : (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {buyer.nickname}님과 거래했어요
          </span>
        )}
      </div>
    );
  }

  if (pendingStatus !== null) {
    return (
      <TradePartnerPicker
        postId={props.postId}
        targetStatus={pendingStatus}
        defaultPartnerId={props.defaultPartnerId ?? buyer?.id ?? null}
        isPending={statusMutation.isPending}
        onSelect={function selectPartner(partner: PostChatPartner | null): void {
          applyStatus(
            pendingStatus,
            partner === null
              ? null
              : { id: partner.id, nickname: partner.nickname, avatarUrl: partner.avatarUrl },
          );
        }}
        onCancel={function cancelPicker(): void {
          setPendingStatus(null);
          setConfirmingSold(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {POST_STATUS_ORDER.map(function renderStatusButton(status: PostStatus) {
          const isCurrent = status === props.status;

          return (
            <button
              key={status}
              type="button"
              disabled={!canChangePostStatus(props.status, status) || statusMutation.isPending}
              aria-pressed={isCurrent}
              onClick={function selectStatus(): void {
                handleSelect(status);
              }}
              className={`${BUTTON_CLASS} ${
                isCurrent
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              {POST_STATUS_LABEL[status]}
            </button>
          );
        })}
      </div>

      {buyer === null || props.status === 'selling' ? null : (
        <span className="text-xs text-gray-500 dark:text-gray-400">예약자: {buyer.nickname}</span>
      )}

      {confirmingSold ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            거래완료로 바꾸면 다시 판매중으로 되돌릴 수 없어요.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={statusMutation.isPending}
              onClick={function confirmSold(): void {
                handleSelect('sold');
              }}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              거래완료로 바꾸기
            </button>
            <button
              type="button"
              onClick={function cancelSold(): void {
                setConfirmingSold(false);
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 transition hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {statusMutation.isError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {/*
            여기서 나는 거절은 **서버가 이유를 한국어로 적어 보내는** 종류다 —
            전이 규칙(0008)과 거래 상대 판정(0035)이 둘 다 트리거라 문구가 실려 온다.
            `toPostErrorMessage`로 받으면 그 문구가 패턴에 안 걸려 "잠시 후 다시 시도해
            주세요"로 떨어지는데, 되풀이해도 안 되는 일이라 **거짓말이 된다.**
            0027이 `chatErrorMessage`에서 겪은 자리와 같다.
          */}
          {toPostActionErrorMessage(statusMutation.error)}
        </p>
      ) : null}
    </div>
  );
}

export default PostStatusControl;
