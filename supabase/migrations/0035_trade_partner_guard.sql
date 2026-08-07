-- =============================================================================
-- 0035_trade_partner_guard.sql — 거래 상대 판정을 정책에서 트리거로
--
-- `backlog.md` §4가 0031의 "새로 미룬 것"으로 적어 둔 항목이다. 0031이 길까지 적어 두었다.
--
--   -- 정책의 판정을 "buyer_id가 **바뀔 때만** 확인하는" 트리거로 옮기는 길도 있다.
--   -- 그편이 규칙의 뜻("고를 때 지킨다")에 더 가깝다.
--
-- 옮기러 왔다가 **구멍을 하나 찾았다.** 옮기는 일보다 그쪽이 크다.
--
-- -----------------------------------------------------------------------------
-- 찾은 것 — 정책이 update에만 걸려 있다
--
-- 0008이 "거래 상대는 채팅을 건 사람 중에서만"을 `posts_update`의 `with check`에 두었다.
-- 그런데 **`posts_insert`는 0001 그대로 `auth.uid() = seller_id` 하나뿐이다.**
-- 즉 이미 있는 글의 구매자를 바꾸는 것은 막히지만, **처음부터 박아 넣고 만드는 것은 안 막힌다.**
--
-- 평범한 계정 하나로 밟아 확인했다.
--
--   ① 채팅 한 번 안 한 이웃을 buyer_id로 박은 `status = 'sold'` 글을 **새로 만든다** → 통과
--   ② 그 글을 근거로 그 이웃에게 −0.5 후기를 넣는다                                  → 통과
--   ③ 피해자 매너온도 36.5 → 36.0
--
-- ②가 통과하는 이유는 0013의 `reviews_insert`가 "거래완료된 글의 두 당사자인가"를 보는데
-- **그 글을 공격자가 방금 지어냈기** 때문이다. 조건은 전부 맞다 — 근거가 가짜일 뿐이다.
-- 후기는 한 글에 한 번이지만(0001의 unique) 글은 얼마든지 만들 수 있어 **되풀이된다.**
--
-- 0013의 머리말이 막겠다고 적은 바로 그것이다.
--
--   -- · 거래한 적 없는 이웃에게 −점수를 꽂을 수 있고
--   -- · score 칸에 −99를 넣어 남의 매너온도를 한 번에 0으로 만들 수 있다
--
-- 뒤의 것은 `reviews_score_allowed`가 닫았고, 앞의 것은 **0008이 update 쪽만 닫았다.**
-- 0013은 "거래한 적 없는"을 `posts`가 이미 보증한다고 믿었고, 0008은 자기가 만지는 명령만
-- 보았다. 둘 사이의 틈이다.
--
-- -----------------------------------------------------------------------------
-- 왜 트리거로 옮기면 둘이 함께 닫히는가
--
-- 정책은 **명령마다 따로** 적는다(insert 정책, update 정책). 그래서 규칙 하나를 지키려면
-- 두 군데에 같은 말을 적어야 하고, 한쪽을 잊으면 지금처럼 조용히 벌어진다.
-- 트리거는 `before insert or update`로 **한 번에** 건다.
--
-- 덤으로 0031의 부채가 풀린다. 정책의 `with check`는 **모든 update에서** 다시 물으므로
-- 근거가 되는 방이 사라지면 제목 수정조차 막혔다. 트리거는 `buyer_id`가 실제로 바뀔 때만
-- 묻는다 — 0031이 적어 둔 "규칙의 뜻에 더 가깝다"가 이것이다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 거래 상대 판정
--
-- `security definer`가 아니다. `chat_rooms_select`가 참여자만 통과시키는데(0001)
-- **이 글을 고치는 사람은 언제나 그 방의 판매자**라 자기 방은 보인다. 나간 방도 보인다 —
-- 0030이 감춘 것은 목록이지 행이 아니다. 굳이 RLS를 끄면 남의 방을 근거로 삼을 길이 열린다.
--
-- **새로 만드는 글은 언제나 막힌다.** 방금 번호를 받은 글을 두고 오간 대화가 있을 리 없어
-- `exists`가 반드시 비기 때문이다. 따로 적지 않아도 "새 글에는 거래 상대가 없다"가 나온다.
--
-- 안 바뀐 update는 그대로 통과시킨다. 이것이 0031의 부채를 갚는 두 줄이다 —
-- 예약중인 글의 판매자가 방이 사라진 뒤에도 제목을 고칠 수 있다.
--
-- `tg_op`으로 가르는 이유는 문법이다. `before insert or update` 트리거의 `when` 절에는
-- `old`를 쓸 수 없어(insert에는 없는 값이다) 판정을 함수 안으로 들여왔다.
-- -----------------------------------------------------------------------------
create or replace function guard_post_buyer()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.buyer_id is not distinct from old.buyer_id then
    return new;
  end if;

  if not exists (
    select 1
      from chat_rooms r
     where r.post_id = new.id
       and r.buyer_id = new.buyer_id
  ) then
    raise exception '거래 상대는 채팅을 나눈 이웃 중에서만 고를 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function guard_post_buyer is
  '거래 상대를 고를 때 그 사람과 채팅한 적이 있는지 본다. insert·update 양쪽에 걸려 지어낸 거래를 막는다(0035).';

-- `when (new.buyer_id is not null)`이 대부분을 걸러 낸다. 구매자가 없는 글은 함수까지 오지도
-- 않는다 — 조회수·끌올·상태 변경 같은 흔한 update가 전부 여기서 끝난다.
--
-- 이름을 `posts_guard_buyer`로 둔 것은 우연이 아니다. before 트리거는 이름순으로 도는데
-- `posts_status_transition`이 "판매중으로 돌아오면 예약자를 지운다"를 한다(0008).
-- 이 트리거가 **먼저** 돌아 사용자가 보낸 값을 그대로 본다 — 뒤에 돌면 지워진 뒤라
-- 무엇을 고르려 했는지 알 수 없다. 0020이 `comments_guard_update`에서 쓴 것과 같은 수다.
drop trigger if exists posts_guard_buyer on posts;
create trigger posts_guard_buyer
  before insert or update on posts
  for each row when (new.buyer_id is not null)
  execute function guard_post_buyer();

-- -----------------------------------------------------------------------------
-- 2. 정책은 소유만 본다
--
-- 0008이 얹은 `with check`의 구매자 갈래를 걷어낸다. 판정이 1번으로 갔으므로 남길 이유가
-- 없고, 남겨 두면 **같은 규칙이 두 군데**가 되어 0031이 겪은 자리가 그대로 남는다.
--
-- `with check (auth.uid() = seller_id)`는 **적어서** 남긴다. 안 적어도 같다 —
-- `with check`가 없으면 Postgres가 `using` 식을 새 행에도 그대로 쓴다. 다만 그 묵시적 동작이
-- 이 저장소에서 한 번 사람을 물었던 자리라(`troble.md`의 "`with check` 없는 update 정책이
-- 삭제를 스스로 막는다"), 여기서는 눈에 보이게 적는 편이 낫다.
--
-- 이렇게 두면 판매자가 자기 글을 남에게 넘길 수 없다는 것도 한 줄로 읽힌다.
-- -----------------------------------------------------------------------------
drop policy if exists posts_update on posts;
create policy posts_update on posts
  for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

comment on column posts.buyer_id is
  '거래 상대. 예약중이면 예약자, 거래완료면 구매자, 판매중이면 null. 채팅을 건 사람 중에서만 고를 수 있다(0035의 guard_post_buyer).';

-- -----------------------------------------------------------------------------
-- 3. 0031의 부채 — 이제 거래 상대로 걸린 방도 지운다
--
-- 0031은 "거래 상대로 걸려 있는 방은 안 지운다"로 좁혀 두었다. 지우면 `posts_update`의
-- 근거가 사라져 판매자가 제목조차 못 고쳤기 때문이다. 1번이 그 이유를 없앴다 —
-- 이미 고른 상대는 다시 묻지 않는다.
--
-- 그 조건 하나만 뺀다. 나머지 셋(양쪽이 나갔다 · 그 뒤에 말이 없다)은 그대로다.
--
-- 방이 사라진 뒤에 상대를 **바꾸려면** 다시 채팅을 걸어야 한다. 맞는 동작이다 —
-- 근거 없이 고르는 일을 막는 것이 이 규칙의 뜻이고, 옛 방은 이미 양쪽이 다 나간 방이다.
-- -----------------------------------------------------------------------------
create or replace function private.is_chat_room_purgeable(p_room_id bigint)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from chat_rooms r
     where r.id = p_room_id
       and r.buyer_left_at  is not null
       and r.seller_left_at is not null
       -- 나간 뒤에 온 말이 있으면 그 사람 목록에는 방이 돌아와 있다(0030).
       and coalesce(r.last_message_at, r.created_at)
           <= least(r.buyer_left_at, r.seller_left_at)
  );
$$;

comment on function private.is_chat_room_purgeable(bigint) is
  '이 방을 완전히 지워도 되는가. 양쪽이 나갔고 그 뒤에 온 말이 없으면 참이다(0031, 거래 상대 조건은 0035에서 뺐다).';

-- -----------------------------------------------------------------------------
-- 4. 이미 들어와 있는 가짜 거래
--
-- 이 저장소에는 없다 — `buyer_id`가 찬 글이 0건이다(확인했다). 그래서 지우거나 되돌릴 것이
-- 없고, 트리거도 **앞으로 바뀌는 값부터** 본다.
--
-- 다른 환경에서 이 파일을 돌릴 때를 위해 찾는 질의만 적어 둔다. 무엇을 해야 할지는
-- 사람이 정할 일이라(지운다 · 상태를 되돌린다 · 후기만 걷어낸다) 자동으로 손대지 않는다.
--
--   select p.id, p.seller_id, p.buyer_id, p.status
--     from posts p
--    where p.buyer_id is not null
--      and not exists (
--        select 1 from chat_rooms r
--         where r.post_id = p.id and r.buyer_id = p.buyer_id
--      );
--
-- 후기까지 지운다면 0016의 `sync_manner_temp`가 온도를 알아서 되돌리고,
-- 0034가 그 되돌림을 이력에 남긴다.
-- =============================================================================
