import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { fetchNotificationPrefs, updateNotificationPref } from '../api/notificationPrefsApi';
import type { NotificationPrefKey, NotificationPrefs } from '../types';

export function notificationPrefsQueryKey(userId: string | null): ReadonlyArray<string> {
  return ['notifications', userId ?? 'anonymous', 'prefs'];
}

/**
 * 내 알림 설정.
 *
 * `staleTime`을 두지 않는다. 여는 일이 드문 화면이고, 다른 기기에서 바꿨을 수도 있어
 * 열 때마다 지금 값을 받아 오는 편이 맞다.
 */
export function useNotificationPrefsQuery(
  userId: string | null,
): UseQueryResult<NotificationPrefs, Error> {
  return useQuery<NotificationPrefs, Error>({
    queryKey: notificationPrefsQueryKey(userId),
    queryFn: function loadPrefs(): Promise<NotificationPrefs> {
      if (userId === null) {
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }
      return fetchNotificationPrefs(userId);
    },
    enabled: userId !== null,
  });
}

export type TogglePrefInput = {
  key: NotificationPrefKey;
  enabled: boolean;
};

/**
 * 스위치 하나를 켜고 끈다.
 *
 * **누르는 즉시 움직인다.** 응답을 기다렸다 그리면 스위치가 잠깐 눌리지 않은 것처럼 보이고,
 * 그 사이 다시 누르면 두 요청이 엇갈린다. 알림 목록의 읽음 표시(0015)가 보내기 전에
 * 캐시를 고치는 것과 같은 이유다.
 *
 * 대신 실패하면 **되돌린다.** 읽음 표시는 되돌리지 않았는데(잃는 것이 굵은 글씨 하나뿐이고
 * 다음 조회가 덮는다) 이쪽은 다르다 — 껐다고 믿은 알림이 계속 오면 설정이 고장 난 것으로 보인다.
 *
 * 서버가 돌려준 세 값으로 마지막에 한 번 더 맞춘다. 요청이 엇갈렸더라도 화면이 서버의
 * 지금 상태로 수렴한다.
 */
export function useToggleNotificationPrefMutation(
  userId: string | null,
): UseMutationResult<NotificationPrefs, Error, TogglePrefInput, NotificationPrefs | undefined> {
  const queryClient = useQueryClient();
  const queryKey = notificationPrefsQueryKey(userId);

  return useMutation<NotificationPrefs, Error, TogglePrefInput, NotificationPrefs | undefined>({
    mutationFn: function submit(input: TogglePrefInput): Promise<NotificationPrefs> {
      if (userId === null) {
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }
      return updateNotificationPref({ userId, key: input.key, enabled: input.enabled });
    },
    onMutate: function applyNow(input: TogglePrefInput): NotificationPrefs | undefined {
      const previous = queryClient.getQueryData<NotificationPrefs>(queryKey);

      queryClient.setQueryData<NotificationPrefs>(
        queryKey,
        function toggleOne(current: NotificationPrefs | undefined): NotificationPrefs | undefined {
          if (current === undefined) {
            return current;
          }
          return { ...current, [input.key]: input.enabled };
        },
      );

      return previous;
    },
    onError: function rollback(
      _error: Error,
      _input: TogglePrefInput,
      previous: NotificationPrefs | undefined,
    ): void {
      if (previous !== undefined) {
        queryClient.setQueryData<NotificationPrefs>(queryKey, previous);
      }
    },
    onSuccess: function settle(saved: NotificationPrefs): void {
      queryClient.setQueryData<NotificationPrefs>(queryKey, saved);
    },
  });
}
