import { selectTheme, THEME_STORAGE_KEY, useUiStore } from './uiStore';
import { DEFAULT_THEME_PREFERENCE } from '../utils/theme';

describe('uiStore', function uiStoreSuite() {
  beforeEach(function resetStore() {
    window.localStorage.clear();
    useUiStore.setState({ theme: DEFAULT_THEME_PREFERENCE });
  });

  it('고른 테마를 상태에 담는다', function setsTheme() {
    useUiStore.getState().setTheme('dark');

    expect(selectTheme(useUiStore.getState())).toBe('dark');
  });

  it('고른 테마를 이 기기에 남긴다', function persistsTheme() {
    // 다음에 다시 열었을 때도 같은 화면이어야 한다 — 서버가 아니라 기기의 설정이다.
    useUiStore.getState().setTheme('light');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});
