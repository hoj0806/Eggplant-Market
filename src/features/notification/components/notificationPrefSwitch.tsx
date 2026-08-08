type NotificationPrefSwitchProps = {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle(next: boolean): void;
};

/**
 * 켜고 끄는 스위치 한 줄.
 *
 * `role="switch"` + `aria-checked`를 쓴다. 체크박스로 만들 수도 있지만 이것은 "고르는 값"이
 * 아니라 **누르는 즉시 바뀌는 상태**다 — 저장 버튼이 없다는 사실이 역할 이름에 드러나야 한다.
 *
 * 이름은 `aria-labelledby`로 왼쪽 글자를 가리킨다. 스위치 안에 글자를 넣으면 켬/끔 표시와
 * 이름이 한 덩어리로 읽힌다.
 *
 * 색만으로 켜짐을 알리지 않는다 — 동그라미가 좌우로 움직이는 것이 두 번째 단서다
 * (알림 목록이 안 읽음을 배경과 점 둘로 알리는 것과 같은 이유).
 */
function NotificationPrefSwitch(props: NotificationPrefSwitchProps) {
  const labelId = `pref-${props.label}`;

  function handleClick(): void {
    props.onToggle(!props.checked);
  }

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={labelId} className="text-sm font-medium text-gray-900 dark:text-gray-50">
          {props.label}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{props.description}</span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        aria-labelledby={labelId}
        disabled={props.disabled}
        onClick={handleClick}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
          props.checked
            ? 'bg-emerald-600'
            : 'bg-gray-300 dark:bg-gray-700'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            props.checked ? 'left-[1.375rem]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default NotificationPrefSwitch;
