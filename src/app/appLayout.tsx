import { Outlet } from 'react-router-dom';
import AppHeaderNav from './appHeaderNav';
import AppTabBar from './appTabBar';

/**
 * 탭바를 달고 사는 화면들의 공용 껍데기.
 *
 * 상세·채팅방·온보딩처럼 한 가지 일에 집중해야 하는 화면은 여기 넣지 않는다.
 * 그런 화면에서 탭바는 "지금 하던 일을 그만두라"는 버튼 다섯 개일 뿐이다.
 *
 * 화면 높이(min-h-screen)는 여기서 한 번만 잡는다. 안쪽 페이지가 각자 잡으면
 * 탭바 자리만큼 늘 넘쳐 스크롤이 생긴다.
 *
 * **길잡이가 폭에 따라 자리를 옮긴다.** 둘을 함께 그리되 서로가 서로를 감춘다 —
 * 상단 내비게이션은 `md`부터(`hidden md:block`), 하단 탭바는 그 아래까지(`md:hidden`).
 * 같은 `APP_TABS`를 읽으므로 자리를 더하면 양쪽에 함께 생긴다.
 */
function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeaderNav />

      {/*
        탭바가 떠 있어 마지막 줄을 가린다. 그 높이만큼 아래를 비운다.
        글쓰기 자리가 탭바 위로 반쯤 올라와 있어(`-mt-6`) 탭바 높이만으로는 모자라다 —
        그만큼 더 비우지 않으면 마지막 줄이 그 원 밑으로 들어가 눌리지 않는다.

        `md:pb-0`인 이유는 그 위에서 탭바가 사라지기 때문이다. 안 지우면 데스크탑마다
        화면 아래에 이유 없는 빈 띠가 96px 남는다.
      */}
      <div className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </div>

      <AppTabBar />
    </div>
  );
}

export default AppLayout;
