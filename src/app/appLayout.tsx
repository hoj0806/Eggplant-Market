import { Outlet } from 'react-router-dom';
import AppTabBar from './appTabBar';

/**
 * 탭바를 달고 사는 화면들의 공용 껍데기.
 *
 * 상세·채팅방·온보딩처럼 한 가지 일에 집중해야 하는 화면은 여기 넣지 않는다.
 * 그런 화면에서 탭바는 "지금 하던 일을 그만두라"는 버튼 다섯 개일 뿐이다.
 *
 * 화면 높이(min-h-screen)는 여기서 한 번만 잡는다. 안쪽 페이지가 각자 잡으면
 * 탭바 자리만큼 늘 넘쳐 스크롤이 생긴다.
 */
function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* 탭바가 떠 있어 마지막 줄을 가린다. 그 높이만큼 아래를 비운다. */}
      <div className="flex-1 pb-16">
        <Outlet />
      </div>
      <AppTabBar />
    </div>
  );
}

export default AppLayout;
