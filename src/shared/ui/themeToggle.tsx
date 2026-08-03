import { selectSetTheme, selectTheme, useUiStore } from '../store/uiStore';
import {
  THEME_PREFERENCE_LABEL,
  THEME_PREFERENCE_ORDER,
  type ThemePreference,
} from '../utils/theme';

const BASE_CLASS = 'rounded-full border px-3 py-1.5 text-sm font-medium transition';
const SELECTED_CLASS = 'border-emerald-600 bg-emerald-600 text-white';
const UNSELECTED_CLASS =
  'border-gray-300 text-gray-700 hover:bg-gray-50 ' +
  'dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

/**
 * 화면 테마 고르기.
 *
 * 두 갈래가 아니라 셋이다 — '시스템'이 없으면 기기 설정을 따르던 사람이
 * 한번 손대는 순간 다시는 그 상태로 돌아갈 수 없다.
 *
 * 채팅 갈래 탭과 같은 칩 모양이다. 같은 일을 하는 장치는 화면마다 같게 생겨야 한다.
 */
function ThemeToggle() {
  const theme = useUiStore(selectTheme);
  const setTheme = useUiStore(selectSetTheme);

  return (
    <div role="group" aria-label="화면 테마" className="flex flex-wrap gap-2">
      {THEME_PREFERENCE_ORDER.map(function renderOption(preference: ThemePreference) {
        const isSelected = theme === preference;

        return (
          <button
            key={preference}
            type="button"
            aria-pressed={isSelected}
            onClick={function selectPreference(): void {
              setTheme(preference);
            }}
            className={`${BASE_CLASS} ${isSelected ? SELECTED_CLASS : UNSELECTED_CLASS}`}
          >
            {THEME_PREFERENCE_LABEL[preference]}
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
