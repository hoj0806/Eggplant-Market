import { Link } from 'react-router-dom';

/**
 * 동네가 없으면 검색할 곳이 없다. 그때 목록 대신 보여주는 화면.
 *
 * **여기 오는 사람은 로그인 사용자뿐이다.** 게스트에게는 기본 동네가 서므로
 * (`useActiveRegion` · `defaultGuestRegion.ts`) 동네가 비는 순간이 없고, 바꾸는 일은
 * `GuestRegionSwitcher`가 맡는다. 예전에 여기 있던 게스트 분기는 그래서 걷어냈다 —
 * 닿지 않는 갈래를 남겨 두면 다음에 이 파일을 여는 사람이 그 길이 살아 있다고 믿는다.
 *
 * 로그인 사용자가 여기 오는 것도 정상 경로는 아니다. `/`는 온보딩이 막지만 `/search`에는
 * 가드가 없어서, 동네를 안 정한 계정이 주소로 바로 들어오면 닿는다.
 * 그래서 동네 설정 화면으로 보내기만 한다.
 */
function SearchRegionPrompt() {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        동네를 설정하면 우리 동네 물건을 검색할 수 있어요.
      </p>
      <Link
        to="/settings/region"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white
                   transition hover:bg-emerald-700"
      >
        동네 설정하기
      </Link>
    </div>
  );
}

export default SearchRegionPrompt;
