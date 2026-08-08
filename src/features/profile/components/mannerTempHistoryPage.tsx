import MyListLayout from './myListLayout';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
import { useMannerTempEventsQuery } from '../hooks/useMannerTempEventsQuery';
import { useMyProfileQuery } from '../hooks/useProfileQuery';
import {
  toMannerTempCauseText,
  toMannerTempEvidenceText,
  toTemperatureDeltaText,
} from '../utils/mannerTempEvent';
import { toTemperatureText } from '../utils/mannerTemperature';
import type { MannerTempEvent } from '../types';

const MESSAGE_CLASS = 'py-8 text-center text-sm text-gray-500 dark:text-gray-400';

/**
 * 매너온도 기록 — 내 온도가 언제 무엇 때문에 움직였는지.
 *
 * **후기 목록과 다른 화면이다.** 후기 목록(0013)은 남들이 남긴 말을 보여 주지만 거기에는
 * 눈금이 없고, 무엇보다 **사라진 후기가 없다.** 글이 지워지거나 쓴 이웃이 떠나면 후기도
 * 함께 사라지는데(0016) 온도는 그만큼 움직인다 — 그때 "왜 내려갔지"에 답하는 자리가 여기다.
 *
 * 비어 있을 때 "기록이 없어요"라고 하지 않는다. 한 번도 안 움직인 사람과 이력이 생기기 전부터
 * 있던 사람이 같은 화면을 보게 되는데, 둘 다에게 맞는 말은 **"아직 움직인 적이 없다"**이다
 * (0034가 백필하지 않은 이유가 이것이다).
 *
 * 현재 온도를 맨 위에 다시 적는다. 이력의 첫 줄과 같은 값이어야 하고, 다르면 그 자체가
 * 알아볼 거리다 — 두 값이 어긋나는 것을 볼 수 있게 두는 것이 이 화면의 목적에 맞다.
 */
function MannerTempHistoryPage() {
  const user = useAuthStore(selectAuthUser);
  const profileQuery = useMyProfileQuery(user?.id ?? null);
  const eventsQuery = useMannerTempEventsQuery(user?.id ?? null);

  const events = eventsQuery.data ?? [];
  // 목록 전체가 같은 순간을 기준으로 "n분 전"을 잰다(commentSection과 같은 이유).
  const now = new Date();

  function renderEvent(event: MannerTempEvent, index: number) {
    // 배열이 최신순이라 **뒤에 있는 줄이 더 오래된 줄**이다.
    const cause = toMannerTempCauseText(event, events[index + 1]);

    return (
      <li key={event.id} className="flex items-start justify-between gap-3 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
            {toTemperatureText(event.beforeTemp)} → {toTemperatureText(event.afterTemp)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {cause === null ? toMannerTempEvidenceText(event) : cause}
          </span>
          {cause === null ? null : (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {toMannerTempEvidenceText(event)}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span
            className={
              event.afterTemp >= event.beforeTemp
                ? 'text-sm font-semibold text-emerald-600 dark:text-emerald-400'
                : 'text-sm font-semibold text-red-600 dark:text-red-400'
            }
          >
            {toTemperatureDeltaText(event)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatTimeAgo(event.createdAt, now)}
          </span>
        </div>
      </li>
    );
  }

  return (
    <MyListLayout title="매너온도 기록">
      <section className="flex items-baseline justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-900">
        <span className="text-sm text-gray-600 dark:text-gray-300">지금 내 매너온도</span>
        <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
          {profileQuery.data === undefined
            ? '—'
            : toTemperatureText(profileQuery.data.mannerTemp)}
        </span>
      </section>

      <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        매너온도는 받은 후기 점수의 합이에요. 모두 36.5°에서 시작합니다. 글이 지워지거나 후기를
        쓴 이웃이 떠나면 그 후기도 함께 사라져서, 받은 적 없는 온도가 남지 않도록 다시 계산해요.
      </p>

      {eventsQuery.isLoading ? (
        <p className={MESSAGE_CLASS}>기록을 불러오는 중입니다…</p>
      ) : eventsQuery.isError ? (
        <p className={MESSAGE_CLASS}>기록을 불러오지 못했습니다.</p>
      ) : events.length === 0 ? (
        <p className={MESSAGE_CLASS}>
          아직 매너온도가 움직인 적이 없어요. 거래를 마치고 후기를 받아 보세요.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {events.map(renderEvent)}
        </ul>
      )}
    </MyListLayout>
  );
}

export default MannerTempHistoryPage;
