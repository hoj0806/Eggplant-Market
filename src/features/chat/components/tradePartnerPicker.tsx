import ProfileAvatar from '../../profile/components/profileAvatar';
import {
  toTradePartnerPrompt,
  toTradePartnerSkipLabel,
} from '../../post/utils/postStatusTransition';
import { usePostChatPartnersQuery } from '../hooks/useChatQueries';
import type { PostStatus } from '../../post/types';
import type { PostChatPartner } from '../types';

type TradePartnerPickerProps = {
  postId: number;
  /** 바꾸려는 상태. 예약중과 거래완료는 묻는 말이 다르다. */
  targetStatus: PostStatus;
  /** 채팅방에서 눌렀다면 그 방 상대가 미리 골라져 있다. */
  defaultPartnerId: string | null;
  isPending: boolean;
  /** 건너뛰면 null. 고른 사람은 통째로 넘긴다 — 부모가 곧바로 이름을 보여줘야 한다. */
  onSelect(partner: PostChatPartner | null): void;
  onCancel(): void;
};

const MESSAGE_CLASS = 'py-4 text-center text-sm text-gray-500 dark:text-gray-400';

/**
 * 예약자·구매자를 고른다.
 *
 * 후보는 이 게시물에 채팅을 건 이웃뿐이다. 서버도 같은 규칙을 들고 있어서
 * (0008의 posts_update 정책) 목록에 없는 사람을 넣으면 RLS가 막는다.
 *
 * 당근과 마찬가지로 **건너뛸 수 있다.** 앱 밖에서 만난 이웃과 거래하는 일이 흔한데
 * 상대를 반드시 고르게 하면 거래완료 자체를 안 누르게 된다.
 */
function TradePartnerPicker(props: TradePartnerPickerProps) {
  const partnersQuery = usePostChatPartnersQuery(props.postId);
  const partners = partnersQuery.data ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        {toTradePartnerPrompt(props.targetStatus)}
      </h2>

      {partnersQuery.isLoading ? <p className={MESSAGE_CLASS}>이웃을 불러오는 중입니다…</p> : null}

      {partnersQuery.isError ? (
        <p role="alert" className={MESSAGE_CLASS}>
          채팅한 이웃을 불러오지 못했습니다.
        </p>
      ) : null}

      {!partnersQuery.isLoading && !partnersQuery.isError && partners.length === 0 ? (
        <p className={MESSAGE_CLASS}>아직 이 상품으로 채팅한 이웃이 없어요.</p>
      ) : null}

      <ul className="flex flex-col gap-1">
        {partners.map(function renderPartner(partner: PostChatPartner) {
          return (
            <li key={partner.roomId}>
              <button
                type="button"
                disabled={props.isPending}
                // 아바타에도 이름이 붙어 있어 그대로 두면 이름이 두 번 읽힌다.
                aria-label={partner.nickname}
                onClick={function selectPartner(): void {
                  props.onSelect(partner);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition
                            hover:bg-gray-50 disabled:opacity-60 dark:hover:bg-gray-900 ${
                              partner.id === props.defaultPartnerId
                                ? 'ring-1 ring-emerald-500'
                                : ''
                            }`}
              >
                <ProfileAvatar
                  nickname={partner.nickname}
                  avatarUrl={partner.avatarUrl}
                  size="sm"
                />
                <span className="truncate text-sm text-gray-900 dark:text-gray-50">
                  {partner.nickname}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={props.isPending}
          onClick={function skipPartner(): void {
            props.onSelect(null);
          }}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700
                     transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700
                     dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {toTradePartnerSkipLabel(props.targetStatus)}
        </button>
        <button
          type="button"
          disabled={props.isPending}
          onClick={props.onCancel}
          className="rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:text-gray-700
                     disabled:opacity-60 dark:text-gray-400 dark:hover:text-gray-200"
        >
          취소
        </button>
      </div>
    </div>
  );
}

export default TradePartnerPicker;
