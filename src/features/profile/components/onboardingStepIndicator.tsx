type OnboardingStepIndicatorProps = {
  current: number;
  total: number;
};

const DOT_BASE_CLASS = 'h-2 w-2 rounded-full transition';

function OnboardingStepIndicator(props: OnboardingStepIndicatorProps) {
  const steps = Array.from({ length: props.total }, function toStepNumber(_unused, index: number) {
    return index + 1;
  });

  return (
    <div className="flex items-center justify-center gap-2">
      <span className="sr-only">{`전체 ${props.total}단계 중 ${props.current}단계`}</span>
      {steps.map(function renderStepDot(step: number) {
        return (
          <span
            key={step}
            aria-hidden="true"
            className={`${DOT_BASE_CLASS} ${
              step <= props.current ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          />
        );
      })}
      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
        {`${props.current}/${props.total}`}
      </span>
    </div>
  );
}

export default OnboardingStepIndicator;
