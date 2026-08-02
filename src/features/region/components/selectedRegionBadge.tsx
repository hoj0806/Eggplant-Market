import type { Region } from '../types';

type SelectedRegionBadgeProps = {
  region: Region;
  label: string;
};

function SelectedRegionBadge(props: SelectedRegionBadgeProps) {
  return (
    <p
      className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5
                 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950
                 dark:text-emerald-200"
    >
      <span className="shrink-0 text-xs font-medium opacity-80">{props.label}</span>
      <span className="font-semibold">{props.region.fullName}</span>
    </p>
  );
}

export default SelectedRegionBadge;
