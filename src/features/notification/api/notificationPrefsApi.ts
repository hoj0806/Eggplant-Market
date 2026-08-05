import { supabase } from '../../../shared/lib/supabaseClient';
import type { NotificationPrefs, NotificationPrefKey } from '../types';

/**
 * `Profile`에 얹지 않고 따로 읽는다.
 *
 * 프로필은 화면 곳곳에서 쓰이는데(카드·헤더·온보딩) 알림 설정을 거기 실으면 이름 하나를
 * 그리려고 설정 셋을 함께 실어 나르게 된다. 무엇보다 **이 값을 쓰는 곳이 설정 화면 하나뿐**이라
 * 알림 기능 안에 두는 편이 찾기 쉽다.
 *
 * 한 줄 리터럴이어야 한다 — 문자열을 `+`로 이으면 supabase-js가 select 결과의 타입을 잃는다
 * (profileApi의 PROFILE_COLUMNS와 같은 이유).
 */
const PREF_COLUMNS = 'notify_comment, notify_like, notify_review';

type PrefsRow = {
  notify_comment: boolean;
  notify_like: boolean;
  notify_review: boolean;
};

function toPrefs(row: PrefsRow): NotificationPrefs {
  return {
    comment: row.notify_comment,
    like: row.notify_like,
    review: row.notify_review,
  };
}

/** 화면의 키를 컬럼 이름으로. 여기 없는 종류는 끌 수 없다(0022). */
const COLUMN_BY_KEY: Readonly<Record<NotificationPrefKey, keyof PrefsRow>> = {
  comment: 'notify_comment',
  like: 'notify_like',
  review: 'notify_review',
};

/**
 * 내 알림 설정.
 *
 * `profiles_select`가 `using (true)`라 남의 것도 읽히지만 부를 일이 없다 —
 * 설정 화면은 언제나 자기 것만 연다. 그래서 인자를 하나만 받는다.
 */
export async function fetchNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PREF_COLUMNS)
    .eq('id', userId)
    .single();

  if (error !== null) {
    throw error;
  }

  return toPrefs(data as PrefsRow);
}

export type UpdateNotificationPrefInput = {
  userId: string;
  key: NotificationPrefKey;
  enabled: boolean;
};

/**
 * 한 종류만 켜고 끈다.
 *
 * 셋을 한꺼번에 보내지 않는 이유는 스위치가 하나씩 눌리기 때문이다. 통째로 보내면 두 개를
 * 빠르게 누를 때 나중 요청이 앞 요청의 값을 옛 상태로 되돌린다.
 *
 * 누구 것인지는 `eq('id', userId)`로 좁히지만 서버가 믿는 것은 그 값이 아니다 —
 * `profiles_update`가 `auth.uid() = id`를 본다(0001). 0023의 트리거도 이 경로로 매너온도가
 * 흘러들지 않는지 함께 본다.
 */
export async function updateNotificationPref(
  input: UpdateNotificationPrefInput,
): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ [COLUMN_BY_KEY[input.key]]: input.enabled })
    .eq('id', input.userId)
    .select(PREF_COLUMNS)
    .single();

  if (error !== null) {
    throw error;
  }

  return toPrefs(data as PrefsRow);
}
