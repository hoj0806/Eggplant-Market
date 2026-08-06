import { useState, type ReactNode } from 'react';
import BlockToggleButton from './blockToggleButton';
import { MENU_ITEM_CLASS as BASE_MENU_ITEM_CLASS } from '../../../shared/ui/menuItem';
import ReportSheet from '../../report/components/reportSheet';
import type { ReportTarget } from '../../report/types';

type SafetyMenuProps = {
  viewerId: string | null;
  targetUserId: string;
  targetNickname: string;
  /** 게시물 화면에서만 온다. 이 자리에서 글 자체를 신고할 수 있다. */
  post?: { id: number; title: string };
  /**
   * 화면마다 다른 항목. 메뉴 맨 아래에 붙는다.
   *
   * 지금 오는 것은 채팅방 나가기 하나다. 신고·차단과 결이 다르지만 **한 화면에 ⋯가 둘일
   * 수는 없어서** 여기 모은다 — 채팅방 헤더는 한 줄에 아바타·이름·메뉴가 이미 차 있다.
   * 항목의 생김새는 `shared/ui/menuItem`의 `MENU_ITEM_CLASS`를 쓰면 나머지와 맞는다.
   */
  extraItems?: ReactNode;
};

const MENU_ITEM_CLASS = BASE_MENU_ITEM_CLASS + ' text-gray-700 dark:text-gray-200';

/**
 * 남을 보는 화면 오른쪽 위의 ⋯ 메뉴 — 신고와 차단이 여기 모인다.
 *
 * 게시물 상세·프로필·채팅방 셋이 같은 메뉴를 쓴다. 세 화면 모두 "이 사람이 이상하다"를
 * 느끼는 자리고, 그때 찾는 곳이 화면마다 다르면 못 찾는다. 판매자 본인에게 붙는
 * `PostOwnerMenu`와 같은 자리·같은 모양이다 — 한 화면에 둘이 함께 뜨는 일은 없다.
 *
 * 게스트와 나 자신에게는 아무것도 그리지 않는다. 신고도 차단도 로그인이 있어야 하고
 * (서버도 같은 판단을 한다), 자기 자신은 둘 다 대상이 아니다.
 */
function SafetyMenu(props: SafetyMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  if (props.viewerId === null || props.viewerId === props.targetUserId) {
    return null;
  }

  // 좁힌 값을 지역 상수로 받아 둔다. props의 필드는 콜백 안에서 좁힘이 풀린다.
  const viewerId = props.viewerId;
  const post = props.post ?? null;

  function openReport(target: ReportTarget): void {
    setReportTarget(target);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="신고 · 차단"
        aria-expanded={isOpen}
        onClick={function toggleMenu(): void {
          setIsOpen(function toggle(previous: boolean): boolean {
            return !previous;
          });
        }}
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
          {post === null ? null : (
            <button
              type="button"
              onClick={function reportPost(): void {
                openReport({
                  type: 'post',
                  // reports.target_id는 text 한 칸이라 게시물 번호도 문자열로 간다.
                  id: String(post.id),
                  label: post.title,
                });
              }}
              className={MENU_ITEM_CLASS}
            >
              게시물 신고
            </button>
          )}

          <button
            type="button"
            onClick={function reportUser(): void {
              openReport({
                type: 'user',
                id: props.targetUserId,
                label: `${props.targetNickname}님`,
              });
            }}
            className={MENU_ITEM_CLASS}
          >
            {props.targetNickname}님 신고
          </button>

          <BlockToggleButton
            viewerId={viewerId}
            targetId={props.targetUserId}
            targetNickname={props.targetNickname}
            variant="menu"
          />

          {props.extraItems}
        </div>
      ) : null}

      {reportTarget === null ? null : (
        <ReportSheet
          target={reportTarget}
          onClose={function closeReport(): void {
            setReportTarget(null);
          }}
          // 신고만으로는 아무것도 사라지지 않는다. 접수 뒤 바로 차단할 수 있게 같은 화면에 둔다.
          completionAction={
            <BlockToggleButton
              viewerId={viewerId}
              targetId={props.targetUserId}
              targetNickname={props.targetNickname}
              variant="primary"
            />
          }
        />
      )}
    </div>
  );
}

export default SafetyMenu;
