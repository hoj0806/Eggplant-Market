-- =============================================================================
-- 0029_message_delete.sql — 보낸 메시지 지우기
--
-- `backlog.md` §4 "메시지 삭제 · 채팅방 나가기". 3단계 때부터 미뤄 둔 항목이다.
--
-- -----------------------------------------------------------------------------
-- 0008이 막아 둔 자리를 다시 연다 — 다만 같은 문으로는 아니다
--
-- 0008은 `content` 변경을 통째로 막았다. 이유가 "대화 기록이 사후에 바뀌면 채팅을 신뢰할 수
-- 없다"였고 그 판단은 지금도 옳다. 그때 막은 것은 **상대가 보낸 말을 고치는 일**이었다.
--
-- 여기서 여는 것은 그 일이 아니다. 잘못 보낸 내 말을 무르는 일이다. 그래서 행을 지우지 않고
-- `deleted_at`을 찍는다 — **말이 오갔다는 사실은 남고 내용만 사라진다.** 0027이 가격 제안
-- 취소를 "없던 일"이 아니라 "취소했다는 기록"으로 남긴 것과 같은 결이다.
--
--   하드 삭제였다면      방 요약이 없는 메시지를 가리키고, 알림 payload의 message_id가 뜨고,
--                        Realtime DELETE를 받는 캐시 경로가 새로 하나 붙는다.
--   소프트 삭제라서      셋 다 없다. 상대 화면에는 **UPDATE**로 도착해 withUpdatedMessage가
--                        이미 있는 자리에 그대로 갈아 끼운다.
--
-- -----------------------------------------------------------------------------
-- 정한 것 셋
--
-- ① **내가 보낸 것만.** 상대의 말을 지우는 것은 기록을 고치는 일이다.
-- ② **되돌릴 수 없다.** 되살리는 길을 열면 `content`를 비운 뒤라 돌려놓을 값이 없다.
-- ③ **가격 제안은 지울 수 없다.** 그 자리는 0027의 취소가 이미 맡고 있다. 열어 두면
--    수락된 제안을 지워 합의를 없앨 수 있고, 그것은 0027이 `accepted`를 잠근 이유와 같다.
--    `pending`만 골라 열 수도 있지만 그러면 취소와 삭제가 같은 버튼 두 개가 된다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 칸
--
-- 인덱스를 더하지 않는다. 이 칸으로 행을 **찾는** 동선이 없다 — 언제나 방 하나를 읽은 뒤
-- 그 안에서 걸러 내는 자리라 0001의 messages_room_idx가 이미 데려다준다.
-- -----------------------------------------------------------------------------
alter table messages
  add column if not exists deleted_at timestamptz;

comment on column messages.deleted_at is
  '보낸 사람이 지운 시각. 행은 남고 content만 비워진다 — 말이 오갔다는 사실은 지우지 않는다(0029).';

-- -----------------------------------------------------------------------------
-- 2. 정책 — "누가"
--
-- 0027이 발신자에게 낸 문은 `type = 'price_offer'` 하나였다. 삭제는 글·사진에도 필요하므로
-- 그 조건으로는 안 된다. 대신 **다른 축으로 좁힌다.**
--
--   지운 메시지는 발신자에게 다시 열리지 않는다 (`deleted_at is null`)
--
-- 되돌릴 수 없다는 결정이 트리거뿐 아니라 정책에도 박힌다. 문이 좁을수록 트리거가 혼자
-- 지는 짐이 줄어든다는 0027의 판단은 그대로다 — 조건만 갈아 끼웠다.
--
-- 받는 쪽(`auth.uid() <> sender_id`)은 0008 그대로다. 지워진 메시지에도 읽음 표시는 남길 수
-- 있다 — 상대가 그 자리를 이미 지나쳤다는 사실은 지운 것과 무관하다.
--
-- **`with check`가 붙는다. 이 파일에서 처음 밟은 자리다.**
--
-- update 정책에 `with check`가 없으면 Postgres는 `using` 식을 **새 행에도 그대로 쓴다.**
-- 0008·0027은 그래도 됐다 — 그 식이 보는 칸(`sender_id`·`type`)을 아무도 바꾸지 않았으니
-- 새 행에서도 언제나 참이었다. 그런데 여기서는 식이 `deleted_at`을 본다. 지우는 순간
-- 그 값이 null이 아니게 되므로 **삭제가 자기 정책에 걸린다.**
--
--   update messages set deleted_at = now() …
--     → new row violates row-level security policy for table "messages"  (실제로 밟았다)
--
-- 그래서 "누가 손댈 수 있는가"(`using`, 옛 행)와 "결과가 여전히 내 방의 행인가"
-- (`with check`, 새 행)를 나눠 적는다. 어느 칸이 어떻게 바뀌었는지는 여전히 트리거의 몫이다.
-- -----------------------------------------------------------------------------
drop policy if exists messages_update on messages;
create policy messages_update on messages
  for update
  using (
    exists (
      select 1
        from chat_rooms r
       where r.id = messages.room_id
         and auth.uid() in (r.buyer_id, r.seller_id)
    )
    and (
      -- 받는 쪽: 읽음 표시와 제안 수락·거절 (0008)
      auth.uid() <> sender_id
      -- 보낸 쪽: 아직 살아 있는 자기 메시지 — 제안 취소(0027)와 삭제(0029)
      or deleted_at is null
    )
  )
  with check (
    exists (
      select 1
        from chat_rooms r
       where r.id = messages.room_id
         and auth.uid() in (r.buyer_id, r.seller_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 3. 트리거 — "무엇을"
--
-- 삭제는 값을 **받지 않는다.** 클라이언트가 보낸 `deleted_at`이 무엇이든 서버가 `now()`로
-- 덮고 `content`도 서버가 비운다. 비우는 일을 클라이언트에 맡기면 "지웠는데 내용이 남은 행"이
-- 생길 수 있고, 그 행은 밖에서 보면 지워진 것처럼 보이므로 아무도 눈치채지 못한다.
--
-- `content` 검사에 조건이 붙는 것이 이 파일이 0027의 목록에 더한 전부다. 지우는 중일 때만
-- 비껴가고, 그 밖에는 여전히 한 글자도 못 고친다.
--
-- 문구를 늘렸다. 0027이 같은 자리에서 겪은 대로 `chatErrorMessage`의 패턴이 함께 따라와야
-- 한다 — 안 따라오면 오류가 아니라 **조용히 기본 문구로 떨어져** 눈에 띄지 않는다.
-- 그래서 이번에는 패턴이 문장 끝("…만")이 아니라 앞부분에 걸리도록 문구를 지었다.
-- -----------------------------------------------------------------------------
create or replace function guard_message_update()
returns trigger
language plpgsql
as $$
declare
  v_deleting boolean := new.deleted_at is distinct from old.deleted_at;
begin
  if v_deleting then
    if new.deleted_at is null then
      raise exception '지운 메시지는 되돌릴 수 없습니다.'
        using errcode = 'check_violation';
    end if;

    if old.deleted_at is not null then
      raise exception '이미 지운 메시지입니다.'
        using errcode = 'check_violation';
    end if;

    if auth.uid() is distinct from old.sender_id then
      raise exception '내가 보낸 메시지만 지울 수 있습니다.'
        using errcode = 'check_violation';
    end if;

    if old.type = 'price_offer' then
      raise exception '가격 제안은 지울 수 없습니다. 답변 대기 중이면 취소할 수 있습니다.'
        using errcode = 'check_violation';
    end if;

    -- 시각도 내용도 서버가 정한다.
    new.deleted_at := now();
    new.content    := null;
  end if;

  if new.room_id      is distinct from old.room_id
  or new.sender_id    is distinct from old.sender_id
  or new.type         is distinct from old.type
  or new.offer_amount is distinct from old.offer_amount
  or new.created_at   is distinct from old.created_at
  or (not v_deleting and new.content is distinct from old.content) then
    raise exception '메시지는 읽음 표시와 제안 답변, 삭제만 할 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  if new.offer_status is distinct from old.offer_status then
    -- null에서 오는 것도 여기 걸린다. 글·사진 메시지를 제안인 척 만들 수 없다.
    if old.offer_status is distinct from 'pending' then
      raise exception '이미 답이 끝난 제안은 바꿀 수 없습니다.'
        using errcode = 'check_violation';
    end if;

    if auth.uid() = old.sender_id then
      if new.offer_status is distinct from 'cancelled' then
        raise exception '보낸 제안은 취소만 할 수 있습니다.'
          using errcode = 'check_violation';
      end if;
    elsif new.offer_status not in ('accepted', 'rejected') then
      raise exception '받은 제안은 수락하거나 거절할 수 있습니다.'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.read_at is distinct from old.read_at and auth.uid() = old.sender_id then
    raise exception '읽음 표시는 받는 쪽만 남길 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function guard_message_update is
  '메시지 update에서 바꿀 수 있는 것을 좁힌다. 읽음 표시는 받는 쪽만, 제안 상태는 pending에서만 '
  '움직이며(0027), 삭제는 보낸 쪽이 자기 글·사진에만 한 번 찍을 수 있다(0029).';

-- 트리거 자체는 0008이 붙여 둔 그대로다. 함수만 갈아 끼웠다.

-- -----------------------------------------------------------------------------
-- 4. 방 요약이 지운 말을 계속 읽고 있으면 안 된다
--
-- `chat_rooms.last_message`는 0001·0008의 on_message_insert가 **보낼 때** 적어 둔 값이다.
-- 마지막 메시지를 지우면 그 값만 남아, 채팅 목록에는 지운 문장이 그대로 보인다.
-- 방에 들어가야만 사라지는 셈이라 지운 사람 입장에서는 지워지지 않은 것과 같다.
--
-- **마지막 메시지일 때만 고친다.** 중간 것을 지운 경우 요약은 여전히 맞는 말이라 손댈 것이 없다.
-- 판단 기준을 `(created_at, id)`로 잡은 것은 0011이 목록에 쓴 것과 같은 이유다 — 같은 시각에
-- 두 건이 들어가면 시각만으로는 어느 것이 마지막인지 정해지지 않는다.
--
-- `last_message_at`은 그대로 둔다. 함께 옮기면 목록에서 방의 자리가 흔들린다 — 지운 것은
-- 내용이지 "그때 대화가 있었다"는 사실이 아니다.
--
-- security definer인 이유는 `chat_rooms`에 update 정책이 없기 때문이다(0001에 select·insert만
-- 있다). 0008의 on_message_insert가 같은 이유로 definer다.
-- -----------------------------------------------------------------------------
create or replace function refresh_room_summary_on_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update chat_rooms r
     set last_message = '지운 메시지입니다'
   where r.id = old.room_id
     and not exists (
       select 1
         from messages m
        where m.room_id = old.room_id
          and (m.created_at, m.id) > (old.created_at, old.id)
     );

  return new;
end;
$$;

comment on function refresh_room_summary_on_delete is
  '마지막 메시지를 지웠을 때 채팅 목록의 요약을 함께 고친다. 중간 것을 지운 경우에는 돌지 않는다(0029).';

drop trigger if exists messages_after_soft_delete on messages;
create trigger messages_after_soft_delete
  after update of deleted_at on messages
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function refresh_room_summary_on_delete();

-- -----------------------------------------------------------------------------
-- 5. 지운 메시지는 안 읽은 수에 들어가지 않는다
--
-- 읽을 것이 없는 줄을 두고 배지가 1을 띄우면, 방에 들어가 "지운 메시지입니다"만 보고 나오게 된다.
-- 0008의 부분 인덱스(messages_unread_idx)는 그대로 쓰인다 — `deleted_at`은 그 위에 얹히는
-- 필터라 인덱스를 무르게 하지 않는다.
--
-- `markRoomRead`(클라이언트)는 손대지 않는다. 지운 줄까지 읽음으로 찍어도 세지 않으므로
-- 결과가 같고, 조건을 하나 더 다는 만큼 어긋날 자리가 는다.
--
-- 함수 본문에서 이 줄 하나만 바뀐다. 나머지는 0014가 차단 조건을 얹은 모양 그대로다.
-- -----------------------------------------------------------------------------
create or replace function fetch_chat_rooms()
returns table (
  id                 bigint,
  post_id            bigint,
  post_title         text,
  post_thumbnail_url text,
  post_status        post_status,
  post_price         integer,
  seller_id          uuid,
  partner_id         uuid,
  partner_nickname   text,
  partner_avatar_url text,
  last_message       text,
  last_message_at    timestamptz,
  unread_count       integer
)
language sql
stable
as $$
  select r.id, p.id, p.title, p.thumbnail_url, p.status, p.price,
         r.seller_id,
         partner.id, partner.nickname, partner.avatar_url,
         r.last_message, r.last_message_at,
         (select count(*)
            from messages m
           where m.room_id = r.id
             and m.sender_id <> auth.uid()
             and m.read_at is null
             and m.deleted_at is null)::integer
    from chat_rooms r
    join posts p on p.id = r.post_id
    -- 상대는 내가 구매자면 판매자, 내가 판매자면 구매자다.
    join profiles partner
      on partner.id = case when r.buyer_id = auth.uid() then r.seller_id else r.buyer_id end
   -- chat_rooms_select가 이미 같은 조건을 걸지만, 조인 대상을 좁혀 두면 계획이 낫다.
   where auth.uid() in (r.buyer_id, r.seller_id)
     -- 차단한(또는 나를 차단한) 상대의 방은 목록에 오지 않는다(0014).
     and partner.id <> all (private.blocked_user_ids())
   order by coalesce(r.last_message_at, r.created_at) desc, r.id desc;
$$;

comment on function fetch_chat_rooms is
  '내가 참여한 채팅방 목록. 상대 프로필·게시물 요약·마지막 메시지·안 읽은 수를 한 번에 돌려준다. '
  '차단 관계에 있는 상대의 방은 빠지고(0014), 지운 메시지는 안 읽은 수에 들어가지 않는다(0029).';
