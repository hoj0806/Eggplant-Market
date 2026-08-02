import RegionPicker from '../../region/components/regionPicker';
import type { Region } from '../../region/types';

type OnboardingRegionStepProps = {
  region: Region | null;
  isPending: boolean;
  errorMessage?: string;
  onRegionChange(region: Region): void;
  onBack(): void;
  onFinish(): void;
};

/**
 * 온보딩 2단계 — 동네 선택.
 * form으로 감싸지 않는다. 검색 입력에서 Enter를 눌렀을 때 온보딩이 그대로 끝나 버리면 안 된다.
 */
function OnboardingRegionStep(props: OnboardingRegionStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <RegionPicker
        value={props.region}
        disabled={props.isPending}
        errorMessage={props.errorMessage}
        onChange={props.onRegionChange}
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={props.isPending}
          onClick={props.onBack}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700
                     transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60
                     dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          이전
        </button>
        <button
          type="button"
          disabled={props.isPending}
          onClick={props.onFinish}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white
                     transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {props.isPending ? '저장 중…' : '시작하기'}
        </button>
      </div>
    </div>
  );
}

export default OnboardingRegionStep;
