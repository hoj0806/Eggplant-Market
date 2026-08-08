/**
 * ⋯ 메뉴 한 줄의 생김새.
 *
 * 신고·차단(`SafetyMenu`·`BlockToggleButton`)과 채팅방 나가기가 한 메뉴에 이웃해 있어
 * 같은 문자열을 써야 한다. 색은 각자 붙인다 — 위험한 항목은 붉게, 나머지는 회색이다.
 *
 * **feature가 아니라 여기 있는 이유**가 있다. 이 상수를 `safetyMenu.tsx`에 두었더니
 * 채팅 쪽에서 문자열 하나를 가져오려고 block 기능 전체를 — 그리고 그것이 끌고 오는
 * `supabaseClient`를 — 함께 불러왔다. 화면 테스트가 `import.meta`에 닿아 로드 단계에서
 * 죽으면서 드러났다(`troble.md`의 "테스트가 import.meta에 닿아 죽는다"와 같은 자리).
 * 생김새는 기능에 속하지 않는다.
 */
export const MENU_ITEM_CLASS =
  'w-full px-4 py-2.5 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800';
