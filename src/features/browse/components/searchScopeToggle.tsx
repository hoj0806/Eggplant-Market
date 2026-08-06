import { Link } from 'react-router-dom';
import { toSearchRadiusLabel } from '../utils/searchRadius';
import type { PostSearchScope } from '../types';

type SearchScopeToggleProps = {
  value: PostSearchScope;
  /** 반경 기준일 때 쓰는 값. 버튼에 그대로 적는다. */
  radiusM: number;
  /**
   * 반경을 바꾸러 갈 수 있는 사람인가. 게스트는 저장할 곳이 없어 기본값으로 본다.
   * 안내 문구가 달라진다 — 못 바꾸는 사람에게 "설정에서 바꾸세요"는 막다른 길이다.
   */
  isGuest: boolean;
  onChange(scope: PostSearchScope): void;
};

const BASE_CLASS = 'flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition';
const SELECTED_CLASS = 'bg-white text-emerald-700 shadow-sm dark:bg-gray-800 dark:text-emerald-400';
const UNSELECTED_CLASS =
  'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100';

/**
 * 목록을 무엇으로 모을지 고르는 자리.
 *
 * 필터 줄이 아니라 그 위에 둔다. 필터는 "우리 동네 안에서 무엇을"이지만 이것은 **우리 동네가
 * 어디까지인가**라, 같은 줄에 놓으면 조건 하나로 읽힌다. "필터 초기화"가 되돌리는 대상도 아니다.
 *
 * 두 칸짜리 세그먼트인 이유는 둘뿐이고 서로 배타적이어서다. 체크박스로 두면 "둘 다 끈" 상태가
 * 생기는데, 그때 무엇을 보여줘야 하는지에 답이 없다.
 */
function SearchScopeToggle(props: SearchScopeToggleProps) {
  function toClickHandler(scope: PostSearchScope) {
    return function handleClick(): void {
      if (scope !== props.value) {
        props.onChange(scope);
      }
    };
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="group"
        aria-label="검색 기준"
        className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900"
      >
        <button
          type="button"
          aria-pressed={props.value === 'region'}
          onClick={toClickHandler('region')}
          className={`${BASE_CLASS} ${props.value === 'region' ? SELECTED_CLASS : UNSELECTED_CLASS}`}
        >
          우리 동네
        </button>
        <button
          type="button"
          aria-pressed={props.value === 'radius'}
          onClick={toClickHandler('radius')}
          className={`${BASE_CLASS} ${props.value === 'radius' ? SELECTED_CLASS : UNSELECTED_CLASS}`}
        >
          {toSearchRadiusLabel(props.radiusM)} 이내
        </button>
      </div>

      {/*
        반경 기준을 고른 순간에만 설명한다. "우리 동네"는 지금까지의 기준이라 설명이 필요 없고,
        늘 띄워 두면 검색어를 치러 온 사람의 화면을 두 줄 밀어낸다.
      */}
      {props.value === 'radius' ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          내 동네를 중심으로 {toSearchRadiusLabel(props.radiusM)} 안에 드는 <b>동네</b>의 글까지
          봅니다.{' '}
          {props.isGuest ? (
            '반경을 바꾸려면 로그인이 필요해요.'
          ) : (
            <Link to="/settings/region" className="underline">
              반경 바꾸기
            </Link>
          )}
        </p>
      ) : null}
    </div>
  );
}

export default SearchScopeToggle;
