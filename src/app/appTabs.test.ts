import { APP_TABS, isTabActive } from './appTabs';

describe('APP_TABS', function appTabsSuite() {
  it('다섯 자리가 모두 다른 주소를 가진다', function hasUniqueRoutes() {
    const routes = APP_TABS.map(function toRoute(tab) {
      return tab.to;
    });

    expect(routes).toHaveLength(5);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('크게 띄우는 자리는 글쓰기 하나뿐이다', function hasSinglePrimary() {
    // 둘이 되면 어느 쪽이 "하러 오는 자리"인지 흐려지고, 탭바에 원이 두 개 뜬다.
    const primary = APP_TABS.filter(function isPrimary(tab) {
      return tab.isPrimary === true;
    });

    expect(primary).toHaveLength(1);
    expect(primary[0].to).toBe('/posts/new');
  });

  it('그 자리가 가운데에 있다', function primaryIsCentered() {
    // 값으로 적어 두었지만 실제로 가운데가 아니면 원이 한쪽으로 치우쳐 뜬다.
    const index = APP_TABS.findIndex(function isPrimary(tab) {
      return tab.isPrimary === true;
    });

    expect(index).toBe(Math.floor(APP_TABS.length / 2));
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
