import { APP_TABS, isTabActive } from './appTabs';

describe('APP_TABS', function appTabsSuite() {
  it('다섯 자리가 모두 다른 주소를 가진다', function hasUniqueRoutes() {
    const routes = APP_TABS.map(function toRoute(tab) {
      return tab.to;
    });

    expect(routes).toHaveLength(5);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

describe('isTabActive', function isTabActiveSuite() {
  it('주소가 같으면 켠다', function matchesExact() {
    expect(isTabActive('/chats', '/chats')).toBe(true);
    expect(isTabActive('/', '/')).toBe(true);
  });

  it('하위 화면도 그 탭으로 본다', function matchesChildren() {
    expect(isTabActive('/my', '/my/likes')).toBe(true);
    expect(isTabActive('/chats', '/chats/12')).toBe(true);
  });

  it('홈은 하위까지 삼키지 않는다', function homeStaysExact() {
    // 모든 주소가 '/'로 시작한다. 하위를 포함하면 홈이 늘 켜져 있게 된다.
    expect(isTabActive('/', '/search')).toBe(false);
    expect(isTabActive('/', '/my/likes')).toBe(false);
  });

  it('주소 앞부분만 겹치는 것은 하위가 아니다', function ignoresPrefixCollision() {
    expect(isTabActive('/my', '/mypage')).toBe(false);
    expect(isTabActive('/posts/new', '/posts/12')).toBe(false);
  });

  it('다른 탭의 주소에서는 꺼진다', function ignoresOtherTabs() {
    expect(isTabActive('/search', '/chats')).toBe(false);
  });
});
