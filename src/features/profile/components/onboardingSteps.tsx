import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import OnboardingForm from './onboardingForm';
import OnboardingRegionStep from './onboardingRegionStep';
import OnboardingStepIndicator from './onboardingStepIndicator';
import { validateRegion } from '../utils/validateProfileInput';
import type { Region } from '../../region/types';
import type { OnboardingDraft, ProfileOnboardingValues } from '../types';

const STEP_PARAM = 'step';
const REGION_STEP = 'region';
const TOTAL_STEPS = 2;

export type CompletedOnboardingDraft = ProfileOnboardingValues & { region: Region };

type OnboardingStepsProps = {
  /** 이미 닉네임이 있는 사용자를 위한 초기값. 임시 닉네임이면 빈 문자열이 온다. */
  initialNickname: string;
  isPending: boolean;
  onComplete(draft: CompletedOnboardingDraft): void;
};

/**
 * 온보딩 두 단계를 끌고 간다. 저장은 마지막에 한 번뿐이다.
 *
 * 단계를 쿼리스트링(?step=region)에 두는 이유: 휴대폰에서 뒤로 가기 제스처가
 * 온보딩을 통째로 빠져나가 입력을 날려 버리지 않고 1단계로 돌아가게 하기 위해서다.
 * 값 자체는 컴포넌트 상태에 있으므로 새로고침하면 사라진다 —
 * 그래서 닉네임이 비어 있으면 2단계 주소로 들어와도 1단계로 되돌린다.
 */
function OnboardingSteps(props: OnboardingStepsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<OnboardingDraft>({
    nickname: props.initialNickname,
    avatarFile: null,
    region: null,
  });
  const [regionError, setRegionError] = useState<string | undefined>(undefined);

  const isRegionStep =
    searchParams.get(STEP_PARAM) === REGION_STEP && draft.nickname.trim().length > 0;

  function goToRegionStep(values: ProfileOnboardingValues): void {
    setDraft(function mergeProfileValues(previous) {
      return { ...previous, ...values };
    });
    setSearchParams({ [STEP_PARAM]: REGION_STEP });
  }

  function goBackToProfileStep(): void {
    setSearchParams({});
  }

  function handleRegionChange(region: Region): void {
    setRegionError(undefined);
    setDraft(function mergeRegion(previous) {
      return { ...previous, region };
    });
  }

  function handleFinish(): void {
    const message = validateRegion(draft.region);
    if (message !== undefined || draft.region === null) {
      setRegionError(message);
      return;
    }

    props.onComplete({
      nickname: draft.nickname,
      avatarFile: draft.avatarFile,
      region: draft.region,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <OnboardingStepIndicator current={isRegionStep ? 2 : 1} total={TOTAL_STEPS} />

      {isRegionStep ? (
        <OnboardingRegionStep
          region={draft.region}
          isPending={props.isPending}
          errorMessage={regionError}
          onRegionChange={handleRegionChange}
          onBack={goBackToProfileStep}
          onFinish={handleFinish}
        />
      ) : (
        <OnboardingForm
          initialValues={{ nickname: draft.nickname, avatarFile: draft.avatarFile }}
          submitLabel="다음"
          isPending={props.isPending}
          onSubmit={goToRegionStep}
        />
      )}
    </div>
  );
}

export default OnboardingSteps;
