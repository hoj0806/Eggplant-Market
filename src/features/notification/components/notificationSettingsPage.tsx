import NotificationPrefSwitch from './notificationPrefSwitch';
import PageHeader from '../../../shared/ui/pageHeader';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import {
  useNotificationPrefsQuery,
  useToggleNotificationPrefMutation,
} from '../hooks/useNotificationPrefs';
import type { NotificationPrefKey, NotificationPrefs } from '../types';

type PrefRow = {
  key: NotificationPrefKey;
  label: string;
  description: string;
};

const SECTION_CLASS =
  'flex flex-col rounded-2xl border border-gray-200 bg-white px-5 shadow-sm ' +
  'divide-y divide-gray-100 dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-950';

/** 순서는 자주 오는 것부터다. 찜이 가장 시끄러워 끄고 싶어질 첫 번째이기도 하다. */
const PREF_ROWS: ReadonlyArray<PrefRow> = [
  { key: 'comment', label: '댓글', description: '내 글에 댓글이 달리거나 내 댓글에 답글이 달릴 때' },
  { key: 'like', label: '관심', description: '내 글을 관심 목록에 담았을 때' },
  { key: 'review', label: '거래후기', description: '거래후기를 받았을 때' },
];

/**
 * 알림 설정 — 종류별로 켜고 끈다.
 *
 * **채팅과 가격 제안은 이 목록에 없다.** 끌 수 없어서다(0022) — 끄면 상대는 답을 기다리는데
 * 나는 모르는 상태가 되고, 그 피해는 내가 아니라 거래 상대에게 간다. 없는 이유를 화면에도
 * 적어 둔다. 목록에 없는 것만으로는 "빠뜨렸나"로 읽힌다.
 *
 * 저장 버튼이 없다. 누르는 즉시 저장되고 실패하면 되돌아간다(useToggleNotificationPrefMutation).
 * 스위치 셋짜리 화면에 저장 버튼을 두면 누르지 않고 나간 사람이 안 바뀐 채로 지낸다.
 *
 * 알림 화면(`/notifications`)이 아니라 마이페이지에서 온다. 그쪽 머리말에는 이미 버튼이
 * 있어(지금은 "모두 삭제") 둘이 나란히 서면 무엇이 주 행동인지 흐려진다.
 * 로그인 가드는 라우터의 RequireMember가 이미 걸었다.
 */
function NotificationSettingsPage() {
  const user = useAuthStore(selectAuthUser);
  const viewerId = user?.id ?? null;

  const prefsQuery = useNotificationPrefsQuery(viewerId);
  const toggleMutation = useToggleNotificationPrefMutation(viewerId);

  if (viewerId === null) {
    return <PageSpinner message="세션을 확인하는 중입니다…" />;
  }

  const prefs: NotificationPrefs | undefined = prefsQuery.data;

  return (
    <main className="flex min-h-screen page-narrow flex-col gap-6 p-6">
      <PageHeader
        backTo="/my"
        backLabel="마이페이지"
        title="알림 설정"
        description="끈 알림은 목록에도 쌓이지 않아요."
      />

      {toggleMutation.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700
                     dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}

      {prefsQuery.isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          설정을 불러오는 중입니다…
        </p>
      ) : prefsQuery.isError || prefs === undefined ? (
        <p role="alert" className="py-10 text-center text-sm text-red-600 dark:text-red-400">
          설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <section className={SECTION_CLASS}>
          {PREF_ROWS.map(function renderRow(row: PrefRow) {
            return (
              <NotificationPrefSwitch
                key={row.key}
                label={row.label}
                description={row.description}
                checked={prefs[row.key]}
                disabled={toggleMutation.isPending && toggleMutation.variables?.key === row.key}
                onToggle={function toggle(next: boolean): void {
                  toggleMutation.mutate({ key: row.key, enabled: next });
                }}
              />
            );
          })}
        </section>
      )}

      <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        채팅과 가격 제안 알림은 끌 수 없어요. 거래 상대가 답을 기다리게 되기 때문이에요.
      </p>
    </main>
  );
}

export default NotificationSettingsPage;
