import { resolveTheme, toThemePreference } from './theme';

describe('toThemePreference', function toThemePreferenceSuite() {
  it('아는 값은 그대로 돌려준다', function keepsKnownValues() {
    expect(toThemePreference('light')).toBe('light');
    expect(toThemePreference('dark')).toBe('dark');
    expect(toThemePreference('system')).toBe('system');
  });

  it('저장된 값이 없으면 시스템을 따른다', function fallsBackWhenEmpty() {
    expect(toThemePreference(null)).toBe('system');
  });

  it('모르는 값은 조용히 기본값으로 떨어진다', function fallsBackWhenUnknown() {
    // localStorage는 사용자가 직접 고칠 수 있는 자리다. 무엇이 들어 있어도 화면이 깨지면 안 된다.
    expect(toThemePreference('sepia')).toBe('system');
    expect(toThemePreference('')).toBe('system');
  });
});

describe('resolveTheme', function resolveThemeSuite() {
  it('직접 고른 값은 시스템 설정을 무시한다', function ignoresSystemWhenExplicit() {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('시스템을 고르면 기기 설정을 따른다', function followsSystem() {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
