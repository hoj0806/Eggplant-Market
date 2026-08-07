import { supabase } from '../../../shared/lib/supabaseClient';
import type { MannerTempEvent } from '../types';

/**
 * 한 번에 읽어 오는 줄 수.
 *
 * 커서 페이징을 붙이지 않았다. 이 표는 **후기 한 건에 한 줄**씩 늘어나는데(0034),
 * 후기는 거래가 끝나야 쓸 수 있어 목록·댓글과 늘어나는 속도가 다르다. 50건이 쌓이려면
 * 거래를 오십 번 해야 한다.
 *
 * 붙일 때가 오면 `manner_temp_events_user_idx`가 `(user_id, created_at desc, id desc)`라
 * 0011의 keyset을 그대로 받는다 — 인덱스는 그 순서로 만들어 두었다.
 */
const EVENT_LIMIT = 50;

const EVENT_COLUMNS = 'id, before_temp, after_temp, review_count, review_sum, created_at';

type MannerTempEventRow = {
  id: number;
  before_temp: number | string;
  after_temp: number | string;
  review_count: number;
  review_sum: number | string;
  created_at: string;
};

/**
 * `numeric`은 PostgREST가 **문자열로** 내려보낸다. 자바스크립트 number로는 정확히 담을 수
 * 없는 값이 있어서다. 온도·합계는 소수 한 자리라 안전하지만, 받는 쪽에서 문자열이 섞이면
 * `beforeTemp - afterTemp`가 조용히 NaN이 되므로 여기서 한 번에 숫자로 바꾼다
 * (`profileApi`가 `manner_temp`에 이미 같은 일을 한다).
 */
function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function toMannerTempEvent(row: MannerTempEventRow): MannerTempEvent {
  return {
    id: row.id,
    beforeTemp: toNumber(row.before_temp),
    afterTemp: toNumber(row.after_temp),
    reviewCount: row.review_count,
    reviewSum: toNumber(row.review_sum),
    createdAt: row.created_at,
  };
}

/**
 * 내 매너온도 이력. 최신순이다 — "왜 방금 내려갔지"가 이 화면을 여는 이유라
 * 가장 최근 줄이 맨 위여야 한다(댓글과 반대, 알림과 같다).
 *
 * 사용자 id를 인자로 받지 않는다. `manner_temp_events_select`가 `auth.uid() = user_id`라
 * **어차피 내 줄만 온다.** 남의 id를 적어 보낼 자리를 만들지 않는 편이 낫다 —
 * 되지도 않는 일을 시도할 수 있게 보이면 정책이 무엇을 막는지가 흐려진다.
 */
export async function fetchMannerTempEvents(): Promise<MannerTempEvent[]> {
  const { data, error } = await supabase
    .from('manner_temp_events')
    .select(EVENT_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(EVENT_LIMIT);

  if (error !== null) {
    throw error;
  }

  return (data as unknown as MannerTempEventRow[]).map(toMannerTempEvent);
}
