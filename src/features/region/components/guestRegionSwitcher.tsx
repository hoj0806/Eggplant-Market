import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import RegionPicker from './regionPicker';
import type { Region } from '../types';

type GuestRegionSwitcherProps = {
  /** 지금 보고 있는 동네. 게스트에게는 언제나 채워져 있다(기본 동네가 대신 선다). */
  region: Region;
  /** 아직 고른 적이 없어 기본 동네가 서 있는 상태인가. 문구가 달라진다. */
  isDefaultRegion: boolean;
  onRegionSelect(region: Region): void;
};

/**
 * 게스트가 보고 있는 동네를 보여주고 그 자리에서 바꾸게 한다.
 *
 * **왜 필요한가.** 게스트에게 기본 동네를 세우면서 `activeRegion.region`이 null이 되는 순간이
 * 없어졌다. 그런데 동네를 고르는 유일한 입구였던 `SearchRegionPrompt`가 바로 그 null일 때만
 * 떴다 — 즉 기본 동네를 세우는 것만으로는 **게스트가 동네를 영영 못 바꾸게 된다.**
 * 기본값과 이 컴포넌트는 한 묶음이라 따로 넣을 수 없다.
 *
 * 로그인 사용자에게는 그리지 않는다. 그쪽 동네는 profiles가 원본이고 `/settings/region`이 맡는다.
 *
 * 접었다 펴는 이유는 자리다. 홈과 검색 모두 첫 화면이 물건 목록이어야 하는데, 동네 선택
 * 위젯은 지도·검색창·목록을 달고 있어 늘 펴 두면 정작 볼 것이 접힌다.
 */
function GuestRegionSwitcher(props: GuestRegionSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  function handleToggle(): void {
    setIsOpen(function toggle(current: boolean): boolean {
      return !current;
    });
  }

  /** 고르고 나면 접는다 — 고른 결과(목록)를 바로 보여주는 것이 다음에 할 일이다. */
  function handleChange(region: Region): void {
    props.onRegionSelect(region);
    setIsOpen(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        className="flex w-fit items-center gap-0.5 text-sm font-semibold text-emerald-700
                   transition hover:underline dark:text-emerald-400"
      >
        {props.region.fullName}
        <ChevronDown size={14} className={isOpen ? 'rotate-180 transition' : 'transition'} />
      </button>

      {/*
        고른 적이 없다는 사실을 적어 둔다. 이 말이 없으면 처음 온 사람은 화면이 어떻게
        자기 동네를 아는지 몰라 목록을 믿지 못한다.
      */}
      {props.isDefaultRegion && !isOpen ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          동네를 정하지 않아 이곳을 보여드리고 있어요. 눌러서 바꿀 수 있습니다.
        </p>
      ) : null}

      {isOpen ? <RegionPicker value={props.region} onChange={handleChange} /> : null}
    </div>
  );
}

export default GuestRegionSwitcher;
