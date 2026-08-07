-- =============================================================================
-- 0034_manner_temp_history.sql — 매너온도 이력
--
-- `backlog.md` §4. 0016이 남긴 항목이다 — "언제 무엇 때문에 올랐는지. 지금은 현재값
-- 하나뿐이라 **어긋남이 생겨도 사후에 되짚을 수 없다**."
--
-- 그 문장은 0016의 머리말에서 그대로 왔다.
--
--   -- 밖에서는 확인할 수 없는 어긋남이라 더 나쁘다. 후기 목록은 근거를 보여주지만
--   -- 온도는 숫자 하나뿐이라, 한 번 어긋나면 무엇이 맞는지 아무도 되짚을 수 없다.
--
-- 0016은 어긋남을 **막는** 일을 했고(합계로 다시 계산), 이 파일은 어긋났을 때 **되짚는**
-- 일을 한다. 둘은 다른 일이다 — 다시 계산하는 함수가 있어도 "언제부터 틀렸나"는 못 답한다.
--
-- -----------------------------------------------------------------------------
-- 왜 지금인가
--
-- 이 표는 **앞으로 지나가는 것만** 담는다. 이미 지나간 변화는 되살릴 방법이 없다 —
-- 후기가 사라진 자국이 어디에도 안 남아 있어서다(그것이 이 파일이 생긴 이유다).
-- 0020이 `updated_at`에서 "이미 쌓인 세 건은 되돌리지 않았다"고 한 것과 같은 자리인데,
-- 여기서는 **미루면 미룬 만큼 영영 비는 구간이 된다.** §4의 다른 항목들과 급이 다른 이유다.
--
-- -----------------------------------------------------------------------------
-- 정한 것 — "왜"를 손으로 적지 않고 **근거**를 남긴다
--
-- 처음에는 `reason` enum(review_added · review_removed · …)을 두려 했다. 버렸다.
--
-- ① **손으로 붙인 이름은 거짓말을 할 수 있다.** 앞으로 온도를 건드리는 길이 하나 늘 때
--    그쪽이 이유를 안 넘기거나 틀리게 넘기면, 표는 멀쩡해 보이면서 틀린 말을 한다.
--    0018이 겪은 자리와 같은 모양이다 — `actor`가 비어 "알 수 없는 이웃님이"로 떨어지는데
--    **폴백이 정상 동작인 척 덮어 버려 버그로 보이지도 않았다.**
--
-- ② **이유를 적어 둬도 어긋남은 못 잡는다.** 되짚고 싶은 것은 "그때 이 값이 맞았나"인데,
--    `reason = 'review_added'`는 그 답을 안 준다. 근거를 적으면 답이 나온다 —
--    `after_temp`가 `36.5 + review_sum`(0~99로 가둔 값)과 다르면 **그 줄이 곧 어긋남이다.**
--
-- 그래서 남기는 것은 바뀐 값 둘과, 바뀐 그 순간의 **후기 개수·점수 합계**다.
-- "무엇 때문에"는 앞 줄과 견주면 나온다 — 개수가 늘었으면 후기가 들어온 것이고,
-- 줄었으면 사라진 것이다. 지어내지 않고 읽어 낸다.
--
-- -----------------------------------------------------------------------------
-- 적는 자리는 `profiles`의 트리거다 — `sync_manner_temp` 안이 아니다
--
-- 지금은 온도를 바꾸는 길이 `sync_manner_temp` 하나뿐이라 어디에 적든 같다. 그래도
-- 트리거로 간 이유는 0016이 실제로 밟은 실패가 그 모양이었기 때문이다 —
-- **`recalc_manner_temp`가 insert에만 붙어 있어 나가는 길을 아무도 보고 있지 않았다.**
--
-- 기록하는 자리는 바꾸는 자리보다 **아래**에 있어야 한다. 칸이 바뀌는 것을 보고 적으면
-- 앞으로 어떤 길이 생기든 그 길도 함께 적힌다. 0032가 "회원탈퇴도 그 사람의 글을 전부
-- 지우므로 RPC가 아니라 트리거"라고 한 것과 같은 판단이다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 표
--
-- `before_temp`·`after_temp`는 `profiles.manner_temp`와 같은 `numeric(4, 1)`이다.
-- `review_sum`은 한 자리 넓다 — 온도는 0~99로 갇히지만 합계는 안 갇힌다. 갇히기 전의
-- 값이어야 "잘려서 안 오른 것"을 알아볼 수 있다(0016이 99.0에서 겪은 그 자리다).
--
-- **`review_id`를 두지 않았다.** 사라진 후기를 가리키는 칸이 되므로 FK를 걸 수 없고
-- (0018의 payload·0032의 알림이 같은 자리였다), FK 없는 id는 지워진 뒤에 아무 데도 못 간다.
-- 개수와 합계만으로 되짚기에 모자라지 않다.
--
-- 지우는 정책도 고치는 정책도 두지 않는다. 이력이 사후에 바뀌면 이력이 아니다 —
-- 0008이 대화 기록에, 0027이 제안에, 0033이 공개 범위에 그은 선과 같다.
-- 사람이 사라질 때만 cascade로 함께 사라진다.
-- -----------------------------------------------------------------------------
create table if not exists manner_temp_events (
  id           bigserial    primary key,
  user_id      uuid         not null references profiles (id) on delete cascade,
  before_temp  numeric(4, 1) not null,
  after_temp   numeric(4, 1) not null,
  review_count integer      not null,
  review_sum   numeric(5, 1) not null,
  created_at   timestamptz  not null default now()
);

comment on table manner_temp_events is
  '매너온도가 실제로 바뀐 기록. 바뀐 값 둘과 그 순간의 후기 개수·합계를 남긴다(0034). 시스템만 쓰고 본인만 읽는다.';
comment on column manner_temp_events.review_sum is
  '그 순간 받은 후기 점수의 합. 0~99로 가두기 전의 값이라 after_temp와 견주면 잘림까지 드러난다.';
comment on column manner_temp_events.review_count is
  '그 순간 받은 후기 개수. 앞 줄과 견주어 "후기가 들어왔나 사라졌나"를 읽어 낸다.';

-- 한 사람의 이력을 최신순으로 읽는다. 정렬 칸까지 넣어 두는 것은 0017이 댓글에서 한 것과 같다.
create index if not exists manner_temp_events_user_idx
  on manner_temp_events (user_id, created_at desc, id desc);

-- -----------------------------------------------------------------------------
-- 2. 누가 읽는가 — 본인만
--
-- 온도 자체는 누구에게나 보인다(`profiles.manner_temp`). 그런데 **이력은 다른 것을 더 말한다.**
--
--   · 언제 거래가 끝났는지가 분 단위로 드러난다(후기가 들어온 시각이다)
--   · **사라진 후기의 자국이 남는다.** 상대가 글을 지웠거나 탈퇴했다는 사실이 새어 나간다
--   · 언제 나쁜 후기를 받았는지가 짚어진다 — 후기 목록에는 순서만 있지 눈금이 없다
--
-- 공개 후기 목록(0013)에 없던 것들이라 "이미 공개된 값의 이력이니 공개해도 된다"가 아니다.
-- 이 표가 답하는 질문은 **"내 온도가 왜 이런가"** 하나이므로 본인만 읽으면 족하다.
--
-- insert·update·delete 정책은 두지 않는다. 0014가 `reports`를 "select 정책이 없어 설계상
-- 관리자 전용"으로 둔 것과 같은 방식이다. 쓰는 일은 아래 3번의 definer 트리거가 RLS 밖에서 한다.
--
-- **`grant`로 좁히려다 그만두었다.** Supabase는 public 스키마의 표에 `anon`·`authenticated`
-- 양쪽으로 **DELETE·INSERT·UPDATE까지 기본 부여**한다(`reports`도 같은 상태인 것을 확인했다).
-- 그러니 `grant select`를 적어도 아무것도 안 좁아진다 — 좁히는 것은 RLS뿐이다.
-- 적어 두면 "권한으로 막았다"고 읽히므로 안 적는 편이 사실에 가깝다.
--
-- 정책이 없을 때 세 명령이 막히는 **모양이 서로 다르다**(밟아 확인했다).
--
--   insert : `42501 new row violates row-level security policy` — 오류로 튄다
--   update
--   delete : 오류가 아니라 **0행에 걸린다.** 조용히 성공하고 아무것도 안 지워진다
--
-- 부를 화면이 없으니 지금은 어느 쪽이든 같지만, 언젠가 "이력 지우기"를 만들 사람이
-- delete가 조용히 성공하는 것을 보고 됐다고 여길 수 있는 자리라 적어 둔다.
-- -----------------------------------------------------------------------------
alter table manner_temp_events enable row level security;

drop policy if exists manner_temp_events_select on manner_temp_events;
create policy manner_temp_events_select on manner_temp_events
  for select
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. 적는 트리거
--
-- `when (old.manner_temp is distinct from new.manner_temp)`가 핵심이다. `sync_manner_temp`는
-- 후기가 들고 날 때마다 무조건 update를 날리므로(합계로 다시 계산한다) **값이 그대로인
-- update가 흔하다** — 나쁜 후기와 좋은 후기가 상쇄되거나, 0~99에 걸려 잘린 채 그대로거나.
-- 그런 줄까지 적으면 이력이 "아무 일도 없었다"로 뒤덮인다.
--
-- 0020이 `posts_set_updated_at`에서 **포함 목록**으로 뒤집은 것과 같은 결이다 —
-- 적을 이유가 있는 것만 적는다.
--
-- 후기 개수·합계를 여기서 다시 센다. `sync_manner_temp`가 방금 센 값을 넘겨받는 편이
-- 싸지만, 그러면 **넘겨주는 쪽이 잊으면 조용히 비는** 칸이 된다(머리말의 ① 그대로다).
-- 온도가 바뀌는 일은 후기 한 건에 한 번이라 조회 하나가 더 도는 것은 값이 싸고,
-- `reviews_reviewee_idx`(0001)가 그 조회를 받는다.
--
-- `security definer`인 이유는 두 가지다. 2번이 insert 정책을 아예 두지 않았고,
-- 앞으로 온도를 바꾸는 길이 definer가 아닌 경로로 생기더라도 기록은 남아야 한다.
--
-- **한 문장으로 후기 여러 건이 들어오면 이력은 한 줄이다**(밟다가 알았다). after 트리거는
-- 문장이 끝난 뒤에 몰려 돌아, 첫 `sync_manner_temp`가 이미 **셋을 다 센 합계**로 온도를
-- 올려놓는다. 나머지 둘은 값이 그대로라 위 `when`에 걸려 안 적힌다.
-- 틀린 기록이 아니다 — 온도는 실제로 한 번 움직였고, 그 줄의 개수·합계도 그 순간의 사실이다.
-- 앱은 `create_review`로 한 건씩 넣으므로(0013) 실제로는 한 건에 한 줄씩 남는다.
-- -----------------------------------------------------------------------------
create or replace function log_manner_temp_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
  v_sum   numeric(5, 1);
begin
  select count(*), coalesce(sum(r.score), 0)
    into v_count, v_sum
    from reviews r
   where r.reviewee_id = new.id;

  insert into manner_temp_events (user_id, before_temp, after_temp, review_count, review_sum)
  values (new.id, old.manner_temp, new.manner_temp, v_count, v_sum);

  return null;   -- after 트리거라 반환값은 쓰이지 않는다.
end;
$$;

comment on function log_manner_temp_change is
  '매너온도가 실제로 바뀌면 바뀐 값과 그 순간의 후기 근거를 manner_temp_events에 남긴다(0034).';

drop trigger if exists profiles_log_manner_temp on profiles;
create trigger profiles_log_manner_temp
  after update on profiles
  for each row when (old.manner_temp is distinct from new.manner_temp)
  execute function log_manner_temp_change();

-- -----------------------------------------------------------------------------
-- 4. 백필하지 않는다
--
-- 할 수가 없다. 지금 온도가 37.0인 사람이 **언제 어떤 순서로** 거기 닿았는지는 남은 곳이
-- 없고(후기의 `created_at`으로 되짚으면 사라진 후기가 통째로 빠진다 — 바로 그 구멍을
-- 메우려고 만드는 표다), 지어낸 줄을 넣으면 어긋남을 잡으려던 표가 스스로 어긋난다.
--
-- 0020이 "그 구분을 남긴 곳이 없다"며 이미 쌓인 값을 되돌리지 않은 것과 같은 판단이다.
-- 이력은 **오늘부터** 정확하다.
--
-- 첫 줄이 찍히기 전까지 화면은 비어 있다. 그때 보여 줄 말은 "아직 변화가 없다"이지
-- "기록이 없다"가 아니다 — 기준값 36.5°에서 한 번도 안 움직인 사람과 같은 화면이 맞다.
-- =============================================================================
