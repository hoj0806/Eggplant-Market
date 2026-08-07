import { MapPin } from 'lucide-react';

type CurrentLocationButtonProps = {
  isPending: boolean;
  disabled: boolean;
  onClick(): void;
};

/** 브라우저 위치 권한을 물어 동네를 자동으로 찾는 버튼. 실패해도 검색으로 계속 진행할 수 있다. */
function CurrentLocationButton(props: CurrentLocationButtonProps) {
  return (
    <button
      type="button"
      disabled={props.disabled || props.isPending}
      onClick={props.onClick}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600
                 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition
                 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60
                 dark:border-emerald-400 dark:text-emerald-300 dark:hover:bg-emerald-950"
    >
      <MapPin size={16} />
      {props.isPending ? '현재 위치를 확인하는 중…' : '현재 위치로 동네 찾기'}
    </button>
  );
}

export default CurrentLocationButton;
