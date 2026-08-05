-- =============================================================================
-- 0016_review_delete.sql — 후기가 사라지면 매너온도도 따라 내려간다
--
-- 0001의 recalc_manner_temp는 **insert에만** 붙어 있다. 후기가 들어오면 온도를 더하는데
-- 나가는 길은 아무도 보고 있지 않다.
--
-- 0013이 "후기는 수정·삭제 정책을 두지 않는다"고 못 박았으니 사용자가 직접 지우는 길은 없다.
-- 그런데도 후기 행이 사라지는 길이 셋이나 있다 — 전부 cascade다.
--
--   ① 게시물이 지워질 때        reviews.post_id     → posts    on delete cascade
--   ② 후기를 **쓴** 사람이 탈퇴  reviews.reviewer_id → profiles on delete cascade
--   ③ 후기를 **받은** 사람이 탈퇴 reviews.reviewee_id → profiles on delete cascade
--
-- ③은 온도를 들고 있던 프로필이 함께 사라지므로 어긋날 것이 없다. 남는 것은 ①②다.
-- 후기 목록에서는 사라졌는데 그 점수는 상대의 온도에 그대로 녹아 있다.
--
--   후기 3건(+0.5 +0.5 −0.5)을 받은 사람      37.0°, 목록 3건
--   그중 하나를 쓴 이웃이 탈퇴하면            37.0°, 목록 2건   ← 근거 없는 0.5°
--
-- ①은 2단계(게시물 삭제)부터, ②는 8단계(회원탈퇴)부터 실제로 밟힌다. 두 기능 모두
-- 거래완료된 글·오래된 계정을 가리지 않고 지우므로 드문 일도 아니다.
--
-- 밖에서는 확인할 수 없는 어긋남이라 더 나쁘다. 후기 목록은 근거를 보여주지만 온도는
-- 숫자 하나뿐이라, 한 번 어긋나면 무엇이 맞는지 아무도 되짚을 수 없다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 더하고 빼는 대신 **후기 합계로 다시 계산한다**
--
-- 지우는 쪽을 `manner_temp - old.score`로 짜면 0001의 더하기와 짝이 맞아 보이지만 맞지 않는다.
-- 양쪽 다 greatest/least로 0~99에 가두기 때문이다. 한 번이라도 끝에 닿으면 더한 값과 뺀 값이
-- 달라진다.
--
--   99.0°에서 +0.5 → 99.0 (잘림)
--   그 후기를 지워 −0.5 → 98.5   ← 받은 적 없는 0.5°를 잃는다
--
-- 그래서 증감을 누적하지 않고 매번 `기준 + 후기 합계`로 되짚는다. 어떤 경로로 몇 건이
-- 사라지든 결과가 같고, 이미 어긋나 있던 값도 다음 후기 한 건에 스스로 맞춰진다.
--
-- 기준값 36.5는 0001의 `profiles.manner_temp ... default 36.5`와 같은 값이다. 열의 기본값을
-- 읽어 오는 방법도 있지만(pg_attrdef) 그 조회가 더 깨지기 쉬워 상수로 둔다.
--
-- 후기가 없는 사람은 sum이 null이라 coalesce로 기준값에 세운다 — 후기를 받았다가 전부
-- 사라진 사람은 처음 상태로 돌아간다.
-- -----------------------------------------------------------------------------
create or replace function sync_manner_temp(p_user uuid)
returns void
language sql
security definer set search_path = public
as $$
  update profiles
     set manner_temp = greatest(0, least(99, 36.5 + coalesce((
           select sum(r.score) from reviews r where r.reviewee_id = p_user
         ), 0)))
   where id = p_user;
$$;

comment on function sync_manner_temp(uuid) is
  '한 사람의 매너온도를 받은 후기 합계로 다시 계산한다(기준 36.5°, 0~99로 가둔다).';

-- -----------------------------------------------------------------------------
-- 2. 들어올 때 — 온도와 알림
--
-- 0001의 함수를 그대로 두고 계산만 위 함수에 넘긴다. 트리거(reviews_after_insert)는
-- 건드리지 않는다. 알림은 여기 남는다 — 후기가 **생겼을 때만** 알릴 일이 있다.
-- -----------------------------------------------------------------------------
create or replace function recalc_manner_temp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform sync_manner_temp(new.reviewee_id);

  insert into notifications (user_id, type, payload)
  values (new.reviewee_id, 'review',
          jsonb_build_object('post_id', new.post_id, 'review_id', new.id));

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. 나갈 때 — 온도만
--
-- 알림을 넣지 않는다. 사라진 후기를 두고 알릴 말이 없고, 넣을 자리도 없다
-- (notification_type에 그런 값이 없다). 이미 보낸 후기 알림도 지우지 않는다 —
-- 0015의 fetch_notifications가 reviews를 left join이라 후기가 없으면 미리보기만 비고,
-- notificationText가 그것을 '알 수 없는 이웃'으로 흘려보낸다.
--
-- old를 돌려주는 것은 after 트리거에서는 값이 쓰이지 않지만, 반환이 없으면 plpgsql이
-- 함수를 끝내지 못한다.
--
-- for each row다. 사람 하나가 탈퇴하면 그 사람이 쓴 후기 수만큼 합계 조회가 도는데,
-- 한 사람이 남기는 후기가 수십 건을 넘지 않아 statement 트리거로 접지 않았다.
-- reviews_reviewee_idx(0001)가 그 조회를 받는다.
-- -----------------------------------------------------------------------------
create or replace function revert_manner_temp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform sync_manner_temp(old.reviewee_id);
  return old;
end;
$$;

drop trigger if exists reviews_after_delete on reviews;
create trigger reviews_after_delete
  after delete on reviews
  for each row execute function revert_manner_temp();

-- -----------------------------------------------------------------------------
-- 4. 이미 어긋나 있는 값 되짚기
--
-- 게시물 삭제는 2단계부터 있었으므로 이 파일 이전에 벌어진 어긋남이 남아 있을 수 있다.
-- 트리거는 앞으로만 지켜 주므로 한 번은 손으로 맞춘다.
--
-- reviews에 남아 있는 사람만 훑고 싶어지지만 그러면 **가장 어긋난 사람을 놓친다** —
-- 받은 후기가 전부 사라진 사람은 reviews에 흔적이 없는데 온도는 옛 값 그대로다.
-- 그 경우를 찾으려면 결국 profiles를 다 돌아야 한다. 후기가 없는 사람은 기준값으로
-- 다시 세워질 뿐이라 손해도 없다.
--
-- 되돌리는 값이 아니라 다시 계산하는 값이라 여러 번 돌려도 결과가 같다.
-- -----------------------------------------------------------------------------
do $$
declare
  v_row record;
begin
  for v_row in select id from profiles loop
    perform sync_manner_temp(v_row.id);
  end loop;
end;
$$;
