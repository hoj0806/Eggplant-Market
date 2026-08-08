import { Link } from 'react-router-dom';
import RegionPicker from '../../region/components/regionPicker';
import type { Region } from '../../region/types';

type SearchRegionPromptProps = {
  isGuest: boolean;
  onRegionSelect(region: Region): void;
};

/**
 * 동네가 없으면 검색할 곳이 없다. 그때 목록 대신 보여주는 화면.
 *
 * 비로그인 사용자는 저장할 프로필이 없으니 온보딩과 같은 위젯으로 동네만 고르게 하고
 * 브라우저에 남긴다. 로그인 사용자가 여기 오는 것은 정상 경로가 아니라서(온보딩이 막는다)
 * 동네 설정 화면으로 보내기만 한다.
 */
function SearchRegionPrompt(props: SearchRegionPromptProps) {
  if (!props.isGuest) {
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

  return (
    <section className="flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          어느 동네에서 찾을까요?
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          중고거래는 동네 단위로 이뤄집니다. 로그인하지 않아도 동네만 고르면 검색할 수 있어요.
        </p>
      </div>

      <RegionPicker value={null} onChange={props.onRegionSelect} />
    </section>
  );
}

export default SearchRegionPrompt;
