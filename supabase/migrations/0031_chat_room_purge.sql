-- =============================================================================
-- 0031_chat_room_purge.sql — 양쪽이 다 나간 방은 지운다
--
-- 0030이 나가기를 "목록에서만 감추는 일"로 만들었다. 그 결정은 **상대가 아직 보고 있기
-- 때문**이었다 — 한쪽이 누른 것으로 상대의 대화까지 지우면 0008이 그은 선을 넘는다.
--
-- 그러면 **둘 다 나간 방**은 이야기가 다르다. 아무도 볼 수 없는 행과 사진이 남아 있을 뿐이라
-- 지워도 잃는 사람이 없다. 사용자가 결정할 것도 없어서 버튼을 만들 필요도 없다.
--
-- -----------------------------------------------------------------------------
-- "둘 다 나갔다"는 것의 정의
--
-- 시각이 둘 다 찍혔다는 것만으로는 부족하다. 0030에서 방은 **나간 뒤에 말이 오면 돌아온다.**
-- 그러니 돌아와 있는 방을 지우면 보고 있는 사람의 화면에서 대화가 사라진다.
--
--   양쪽 left_at이 모두 있고,
--   마지막 말이 **둘 중 먼저 나간 시각보다 앞설 때**   ← 그래야 양쪽 목록에서 모두 빠져 있다
--
-- 목록에 보이는 조건(0030)의 정확한 반대다. 그래서 조건을 한 군데
-- (`private.is_chat_room_purgeable`)에 적고 셋이 나눠 쓴다 — 나가기 · 지우기 · 사진 정리.
-- 갈리면 "지울 수 있다고 해 놓고 안 지워지는" 상태가 생긴다.
--
-- -----------------------------------------------------------------------------
-- 지우지 않는 방 하나 — 거래 상대로 걸려 있는 방
--
-- 0008의 `posts_update`는 `with check`로 **"거래 상대는 채팅을 건 사람 중에서만"**을 지킨다.
-- 그 판단의 유일한 근거가 `chat_rooms` 행이다. 지워 버리면 근거가 사라져서, 예약중인 글의
-- 판매자가 **제목조차 못 고치게 된다**(실제로 밟아 확인했다 — `new row violates row-level
-- security policy for table "posts"`).
--
-- 정책의 판정을 "buyer_id가 **바뀔 때만** 확인하는" 트리거로 옮기는 길도 있다. 그편이
-- 규칙의 뜻("고를 때 지킨다")에 더 가깝다. 다만 이번 일 때문에 핵심 정책을 건드릴 이유는
-- 없어서, **여기서는 그런 방을 지우지 않는 쪽**으로 좁혔다. 거래가 걸려 있는 방이 남는 것은
-- 손해가 아니다 — 어차피 양쪽 목록에 없다.
--
-- -----------------------------------------------------------------------------
-- 사진은 DB가 못 지운다
--
-- `storage.objects` 행을 지워도 실제 파일은 남는다. 그래서 순서를 **파일 먼저, 행 나중**으로
-- 잡고 클라이언트가 두 번에 나눠 부른다.
--
--   leave_chat_room  → 나가기 + "이제 지울 수 있는가"를 돌려준다
--   (지울 수 있으면) 클라이언트가 그 방 폴더를 비운다
--   purge_chat_room  → 알림 정리 + 방 삭제(메시지는 cascade)
--
-- 반대로 하면 방이 사라진 뒤라 `chat_images_select`가 막혀 목록조차 못 읽는다.
-- 중간에서 끊기면 방은 남는다 — 양쪽에게 안 보이는 상태 그대로라, 지금과 같을 뿐이다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 조건 하나, 쓰는 데 셋
--
-- `security definer`가 아니다. 부르는 사람의 권한으로 `chat_rooms`를 읽어야
-- `chat_rooms_select`가 남의 방을 흘려보내지 않는다(0008의 fetch_chat_rooms와 같은 이유).
-- 참여자 확인을 따로 적지 않아도 되는 것이 그 덕이다 — 다만 definer 안에서 부를 때는
-- RLS가 꺼지므로, 그쪽(purge_chat_room)에서는 참여자를 직접 본다.
--
-- private에 두는 이유는 0014와 같다. PostgREST가 public 스키마만 라우팅하므로,
-- 클라이언트가 직접 부를 일이 없는 판단은 여기 둔다.
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
       -- 거래 상대로 걸려 있는 방은 0008의 posts_update가 근거로 삼는다. 위 주석 참고.
       and not exists (
         select 1
           from posts p
          where p.id = r.post_id
            and p.buyer_id = r.buyer_id
       )
  );
$$;

comment on function private.is_chat_room_purgeable(bigint) is
  '이 방을 완전히 지워도 되는가. 양쪽이 나갔고 그 뒤에 온 말이 없으며 거래 상대로 걸려 있지 않을 때만 참이다(0031).';

grant execute on function private.is_chat_room_purgeable(bigint) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. 나가기 — 이제 답을 돌려준다
--
-- 0030의 함수에 반환값만 더한다. 나간 **뒤에** 재기 때문에, 내가 마지막 한 사람이면 참이다.
-- 반환 타입이 바뀌므로 `create or replace`로는 안 되어 드롭하고 다시 만든다.
--
-- 여기서 바로 지우지 않는 이유가 사진이다(머리말 참고). 지우는 일은 클라이언트가 폴더를
-- 비운 뒤 `purge_chat_room`이 맡는다.
-- -----------------------------------------------------------------------------
drop function if exists leave_chat_room(bigint);

create or replace function leave_chat_room(p_room_id bigint)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_buyer  uuid;
  v_seller uuid;
begin
  select buyer_id, seller_id into v_buyer, v_seller
    from chat_rooms where id = p_room_id;

  if not found then
    raise exception '채팅방을 찾을 수 없습니다.' using errcode = 'no_data_found';
  end if;

  if auth.uid() is null or auth.uid() not in (v_buyer, v_seller) then
    raise exception '참여 중인 채팅방이 아닙니다.' using errcode = 'insufficient_privilege';
  end if;

  update chat_rooms
     set buyer_left_at  = case when v_buyer  = auth.uid() then now() else buyer_left_at  end,
         seller_left_at = case when v_seller = auth.uid() then now() else seller_left_at end
   where id = p_room_id;

  return private.is_chat_room_purgeable(p_room_id);
end;
$$;

comment on function leave_chat_room(bigint) is
  '이 방을 내 채팅 목록에서 치운다. 대화도 방도 지우지 않고 상대 화면은 그대로다(0030). '
  '내가 마지막 한 사람이면 참을 돌려준다 — 그때는 사진을 지우고 purge_chat_room을 부른다(0031).';

-- -----------------------------------------------------------------------------
-- 3. 완전 삭제
--
-- 조건을 **여기서 다시 잰다.** 클라이언트가 `leave_chat_room`의 답을 들고 오지만, 그 사이에
-- 상대가 주소로 들어와 말을 걸었을 수 있다(나간 방도 주소로는 열린다 — 0030).
-- 그때는 조용히 거짓을 돌려준다. 지울 수 없게 된 것이지 오류가 아니다.
--
-- 메시지는 `messages_room_id_fkey`가 cascade라 따로 지우지 않는다.
--
-- **알림은 cascade가 없다.** payload가 jsonb라 FK가 걸릴 자리가 없어서, 방이 사라지면
-- 눌러도 갈 곳이 없는 알림이 남는다(실제로 남는 것을 확인했다). 0015가 차단에서 같은 자리를
-- 같은 방식으로 치웠다 — 목록에서 거르는 대신 그 순간 지운다. 여기서는 거를 방법조차 없다.
--
-- `security definer`인 이유가 둘이다. `chat_rooms`에 delete 정책이 없고(0001에 select·insert만),
-- `notifications`에도 delete 정책이 없다(0015가 그것을 열지 않기로 했다).
-- 그래서 참여자 확인을 함수가 직접 한다.
-- -----------------------------------------------------------------------------
create or replace function purge_chat_room(p_room_id bigint)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_buyer  uuid;
  v_seller uuid;
begin
  select buyer_id, seller_id into v_buyer, v_seller
    from chat_rooms where id = p_room_id;

  if not found then
    -- 이미 지워졌다. 두 번 불러도 같은 답이어야 한다.
    return false;
  end if;

  if auth.uid() is null or auth.uid() not in (v_buyer, v_seller) then
    raise exception '참여 중인 채팅방이 아닙니다.' using errcode = 'insufficient_privilege';
  end if;

  if not private.is_chat_room_purgeable(p_room_id) then
    return false;
  end if;

  delete from notifications n
   where (n.payload ->> 'room_id')::bigint = p_room_id
      or exists (
        select 1 from messages m
         where m.id = (n.payload ->> 'message_id')::bigint
           and m.room_id = p_room_id
      );

  delete from chat_rooms where id = p_room_id;

  return true;
end;
$$;

comment on function purge_chat_room(bigint) is
  '양쪽이 다 나간 방을 완전히 지운다. 메시지는 cascade로, 알림은 여기서 함께 지운다. '
  '조건이 깨졌으면 거짓만 돌려준다 — 오류가 아니다(0031).';

-- -----------------------------------------------------------------------------
-- 4. 사진 — 지울 수 있는 방의 폴더는 참여자가 비운다
--
-- 0008의 `chat_images_delete`는 **올린 사람 본인**에게만 열려 있었다. 메시지 insert가
-- 실패했을 때 방금 올린 파일을 되돌리는 보상 용도였기 때문이다. 그대로 두면 방을 지울 때
-- **상대가 올린 사진을 아무도 못 지운다** — 방이 사라지고 나면 `chat_images_select`도 막혀
-- 목록에조차 안 잡히는 완전한 쓰레기가 된다.
--
-- 그래서 문을 하나 더 낸다. **지울 수 있는 방**의 폴더에 한해서만이다.
-- 오가는 중인 방에는 열리지 않는다 — 열면 대화 도중에 상대의 사진을 지울 수 있게 되고,
-- 그건 0008이 `content`를 잠근 이유와 같은 종류의 구멍이다.
-- -----------------------------------------------------------------------------
drop policy if exists chat_images_delete on storage.objects;
create policy chat_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (
      -- 보상 삭제: 방금 올린 내 파일 (0008)
      (storage.foldername(name))[2] = auth.uid()::text
      -- 방을 지우기 직전의 뒷정리: 양쪽이 다 나간 방의 폴더 (0031)
      or exists (
        select 1
          from chat_rooms r
         where r.id::text = (storage.foldername(name))[1]
           and auth.uid() in (r.buyer_id, r.seller_id)
           and private.is_chat_room_purgeable(r.id)
      )
    )
  );
