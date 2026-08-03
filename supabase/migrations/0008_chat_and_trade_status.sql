-- =============================================================================
-- 채팅 · 거래 상태
--
-- 0001에 chat_rooms·messages·post_status가 이미 있다. 이 파일이 채우는 것은 그 위의
-- "규칙"과 "빠진 배관"이다.
--
--   규칙  누가 방을 팔 수 있는가 / 무엇을 고칠 수 있는가 / 상태는 어디로 갈 수 있는가
--   배관  Realtime publication, 채팅 사진 저장소, 목록을 한 번에 읽는 RPC
--
-- 거래 상태는 당근마켓을 그대로 옮긴다. 상태를 바꾸는 행위는 곧 "누구와 거래했는지"를
-- 고르는 행위이고, 그 후보는 **나에게 채팅을 건 사람들**이다. 그래서 채팅과 한 파일에 있다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 거래 상대
--
-- 예약자와 구매자를 컬럼 하나로 겸한다. 당근에서도 같은 자리다 —
-- 예약중이면 예약자, 거래완료면 구매자, 판매중이면 비어 있다.
-- 둘로 나누면 "예약자와 구매자가 다른" 상태를 표현할 수 있게 되는데 그건 화면에 없는 상태다.
--
-- on delete set null : 상대가 탈퇴해도 거래완료 사실 자체는 남아야 한다.
-- -----------------------------------------------------------------------------
alter table posts
  add column if not exists buyer_id uuid references profiles (id) on delete set null,
  add column if not exists sold_at  timestamptz;

comment on column posts.buyer_id is
  '거래 상대. 예약중이면 예약자, 거래완료면 구매자, 판매중이면 null. 채팅을 건 사람 중에서만 고를 수 있다(posts_update 정책).';
comment on column posts.sold_at is
  '거래완료로 바뀐 시각. 상태 전이 트리거가 채운다. 거래후기·구매내역의 기준.';

-- 판매자가 자기 자신을 구매자로 넣을 수 없다. 같은 테이블의 두 컬럼 비교라 check로 충분하다
-- (다른 테이블을 봐야 하는 조건은 check가 아니라 RLS다 — troble.md #13).
alter table posts drop constraint if exists posts_buyer_is_not_seller;
alter table posts add constraint posts_buyer_is_not_seller
  check (buyer_id is null or buyer_id <> seller_id);

create index if not exists posts_buyer_idx on posts (buyer_id);

-- -----------------------------------------------------------------------------
-- 2. 거래 상대는 "채팅한 사람" 중에서만
--
-- 0001의 posts_update는 using만 있고 with check가 없다. 그래서 판매자가 아무 uuid나
-- 구매자로 박을 수 있다 — 거래하지 않은 이웃이 내 구매내역에 남고, 나중에 그 사람 앞으로
-- 후기가 쌓인다.
--
-- 이 저장소의 다른 update 정책은 using만 쓴다. 여기만 with check를 더하는 이유가 이것이다.
-- "이 행을 쓸 수 있는가"를 다른 테이블(chat_rooms)의 값으로 판단해야 하므로 check 제약으로는
-- 막을 수 없다(0006의 likes_insert와 같은 자리).
--
-- increment_view_count·sync_post_like_count는 security definer라 RLS를 타지 않아 영향이 없다.
-- -----------------------------------------------------------------------------
drop policy if exists posts_update on posts;
create policy posts_update on posts
  for update
  using (auth.uid() = seller_id)
  with check (
    auth.uid() = seller_id
    and (
      buyer_id is null
      or exists (
        select 1
          from chat_rooms r
         where r.post_id = posts.id
           and r.buyer_id = posts.buyer_id
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 3. 상태 전이 규칙
--
-- 판매중 ↔ 예약중은 자유롭게 오간다. 거래가 틀어지는 일은 흔하다.
-- 거래완료는 종착점이다 — 후기·매너온도·구매내역이 여기 매달리므로 되돌리면 앞뒤가 맞지 않는다.
--
-- before update of status 라 status를 SET에 넣은 update에서만 돈다.
-- 값이 그대로인 경우까지 오므로 맨 앞에서 걸러 낸다.
-- -----------------------------------------------------------------------------
create or replace function enforce_post_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'sold' then
    raise exception '거래완료된 게시물의 상태는 되돌릴 수 없습니다.'
      using errcode = 'check_violation';
  end if;

  -- 판매중으로 돌아오면 예약자를 지운다. "판매중인데 예약자가 있는" 상태를 남기지 않는다.
  if new.status = 'selling' then
    new.buyer_id := null;
  end if;

  if new.status = 'sold' then
    new.sold_at := now();
  end if;

  return new;
end;
$$;

comment on function enforce_post_status_transition is
  '거래 상태 전이 규칙. 판매중↔예약중은 자유, 거래완료는 되돌릴 수 없다. 판매중 복귀 시 예약자를 지우고 거래완료 시 sold_at을 찍는다.';

drop trigger if exists posts_status_transition on posts;
create trigger posts_status_transition
  before update of status on posts
  for each row execute function enforce_post_status_transition();

-- 상태 변경은 "수정"이 아니라고 볼 여지도 있으나, 판매자가 의도적으로 누른 변경이므로
-- updated_at은 그대로 따라 오르게 둔다(0005의 조회수·찜 제외 조건은 유지된다).

-- -----------------------------------------------------------------------------
-- 4. 자기 게시물에는 채팅을 걸 수 없다
--
-- 0001의 chat_rooms_insert는 `auth.uid() = buyer_id`뿐이라 두 구멍이 있다.
--   ① 본인 글에도 방을 팔 수 있다 (todo.md가 명시적으로 금지한 것)
--   ② seller_id를 클라이언트가 보낸 대로 믿는다 — 엉뚱한 사람이 판매자로 박힌 방이 생긴다
-- 0006의 likes_insert와 같은 형태로 둘을 한 번에 막는다.
-- -----------------------------------------------------------------------------
drop policy if exists chat_rooms_insert on chat_rooms;
create policy chat_rooms_insert on chat_rooms
  for insert
  with check (
    auth.uid() = buyer_id
    and exists (
      select 1
        from posts p
       where p.id = chat_rooms.post_id
         and p.seller_id = chat_rooms.seller_id
         and p.seller_id <> auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 5. 메시지는 읽음 표시만 고칠 수 있다
--
-- 0001의 messages_update는 `방 참여자면 update 가능`이라 **상대가 보낸 메시지의 content까지
-- 고칠 수 있다.** 대화 기록이 사후에 바뀌면 채팅을 신뢰할 수 없다.
--
-- 정책은 "어느 컬럼이 바뀌었는가"를 볼 수 없다(with check도 새 행만 본다).
-- 그래서 둘로 나눈다 — 정책이 "누가"를, 트리거가 "무엇을"을 막는다.
-- 읽음 표시는 받은 사람이 찍으므로 발신자 본인은 아예 update 대상이 아니다.
-- -----------------------------------------------------------------------------
drop policy if exists messages_update on messages;
create policy messages_update on messages
  for update
  using (
    auth.uid() <> sender_id
    and exists (
      select 1
        from chat_rooms r
       where r.id = messages.room_id
         and auth.uid() in (r.buyer_id, r.seller_id)
    )
  );

create or replace function guard_message_update()
returns trigger
language plpgsql
as $$
begin
  -- offer_status는 열어 둔다. 가격 제안 수락·거절이 받는 쪽의 권한이다.
  if new.room_id      is distinct from old.room_id
  or new.sender_id    is distinct from old.sender_id
  or new.type         is distinct from old.type
  or new.content      is distinct from old.content
  or new.offer_amount is distinct from old.offer_amount
  or new.created_at   is distinct from old.created_at then
    raise exception '메시지는 읽음 표시만 바꿀 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function guard_message_update is
  '메시지 update에서 read_at·offer_status 외의 컬럼 변경을 막는다. 대화 기록이 사후에 바뀌지 않게 하는 자리.';

drop trigger if exists messages_guard_update on messages;
create trigger messages_guard_update
  before update on messages
  for each row execute function guard_message_update();

-- 안 읽은 메시지를 세는 동선 전용 인덱스.
-- chat_rooms에 unread_count 컬럼을 두는 방법(0005의 like_count 패턴)도 있으나 보내는 쪽과
-- 읽는 쪽 양쪽에서 갱신해야 해 트리거가 둘 필요하다. 방 개수가 적어 부분 인덱스로 충분하다.
create index if not exists messages_unread_idx
  on messages (room_id, sender_id)
  where read_at is null;

-- -----------------------------------------------------------------------------
-- 6. 방 요약에 사진을 어떻게 적을 것인가
--
-- 0001의 on_message_insert는 content를 그대로 요약으로 쓴다. 채팅 사진은 비공개 버킷이라
-- content에 저장 경로가 들어가는데(아래 8번), 그대로 두면 채팅 목록에
-- `12/8f3c…/1754…-0.jpg`가 마지막 메시지로 뜬다.
--
-- 나머지 동작(알림 insert)은 0001 그대로다. 요약을 만드는 부분만 바꾼다.
-- -----------------------------------------------------------------------------
create or replace function on_message_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_recipient uuid;
  v_summary   text;
begin
  v_summary := case
                 when new.type = 'image'       then '사진을 보냈어요'
                 when new.type = 'price_offer' then coalesce(new.offer_amount::text, '0') || '원 제안'
                 else coalesce(new.content, '(메시지)')
               end;

  update chat_rooms
     set last_message = v_summary, last_message_at = new.created_at
   where id = new.room_id;

  select case when buyer_id = new.sender_id then seller_id else buyer_id end
    into v_recipient
    from chat_rooms where id = new.room_id;

  insert into notifications (user_id, type, payload)
  values (v_recipient,
          case when new.type = 'price_offer' then 'price_offer'::notification_type
               else 'chat'::notification_type end,
          jsonb_build_object('room_id', new.room_id, 'message_id', new.id));

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Realtime
--
-- docs/architecture.md는 처음부터 Realtime 구독을 전제했지만 publication 설정이 저장소
-- 어디에도 없었다. 대시보드에서 켜면 db reset으로 재현되지 않으므로 여기에 남긴다.
--
-- alter publication ... add table은 이미 들어 있으면 오류라 존재 확인 후에 실행한다.
-- replica identity full : update 이벤트에서 이전 행 전체가 필요하다(읽음 표시 반영).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_rooms'
  ) then
    alter publication supabase_realtime add table chat_rooms;
  end if;
end;
$$;

alter table messages   replica identity full;
alter table chat_rooms replica identity full;

-- -----------------------------------------------------------------------------
-- 8. 채팅 사진 저장소 — 비공개
--
-- avatars(0002)·post-images(0005)는 공개 버킷이다. 그 둘은 원래 남에게 보이라고 올리는 것이라
-- 그래도 됐다. 채팅 사진은 1:1 대화 내용이라 공개로 두면 URL을 아는 누구나 볼 수 있다.
--
-- 그래서 public = false로 두고 경로 첫 칸을 room_id로 잡아 **방 참여자만** 읽게 한다.
-- 앱은 읽을 때마다 서명 URL을 만든다.
--
--   경로 규칙  {room_id}/{user_id}/{timestamp}-{index}.{ext}
--
-- 두 번째 칸이 user_id인 이유는 "올린 사람"을 경로에 남겨 두면 정책이 간단해지기 때문이다
-- (avatars·post-images의 본인 폴더 규칙과 결이 같다).
-- 정책 이름을 chat_images_*로 두는 것은 storage.objects에 이미 post_images_select가 있어서다.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  false,
  5242880,                                                   -- 5MB, post-images와 동일
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_images_select on storage.objects;
drop policy if exists chat_images_insert on storage.objects;
drop policy if exists chat_images_delete on storage.objects;

create policy chat_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1
        from chat_rooms r
       where r.id::text = (storage.foldername(name))[1]
         and auth.uid() in (r.buyer_id, r.seller_id)
    )
  );

create policy chat_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1
        from chat_rooms r
       where r.id::text = (storage.foldername(name))[1]
         and auth.uid() in (r.buyer_id, r.seller_id)
    )
  );

-- 메시지 insert가 실패했을 때 방금 올린 파일을 되돌리는 데만 쓴다(postApi.createPost와 같은 보상).
create policy chat_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 9. 방 목록 · 방 하나
--
-- 화면 하나에 필요한 것이 네 군데(chat_rooms·posts·profiles·messages)에 흩어져 있다.
-- PostgREST 임베드로도 상대 프로필까지는 되지만 "안 읽은 수"는 집계라 방마다 한 번씩 세게 된다.
--
-- security definer를 쓰지 않는다 — 0007의 search_posts와 같은 이유로, 호출자 권한이어야
-- chat_rooms_select 정책이 그대로 걸려 남의 방이 새지 않는다.
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
             and m.read_at is null)::integer
    from chat_rooms r
    join posts p on p.id = r.post_id
    -- 상대는 내가 구매자면 판매자, 내가 판매자면 구매자다.
    join profiles partner
      on partner.id = case when r.buyer_id = auth.uid() then r.seller_id else r.buyer_id end
   -- chat_rooms_select가 이미 같은 조건을 걸지만, 조인 대상을 좁혀 두면 계획이 낫다.
   where auth.uid() in (r.buyer_id, r.seller_id)
   order by coalesce(r.last_message_at, r.created_at) desc, r.id desc;
$$;

comment on function fetch_chat_rooms is
  '내가 참여한 채팅방 목록. 상대 프로필·게시물 요약·마지막 메시지·안 읽은 수를 한 번에 돌려준다.';

create or replace function fetch_chat_room(p_room_id bigint)
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
  select * from fetch_chat_rooms() f where f.id = p_room_id;
$$;

comment on function fetch_chat_room(bigint) is
  '채팅방 하나의 요약. 채팅 화면이 게시물 API를 몰라도 되도록 fetch_chat_rooms와 같은 모양으로 돌려준다.';

-- -----------------------------------------------------------------------------
-- 10. 채팅 시작
--
-- "채팅하기"는 방이 없으면 만들고 있으면 그 방으로 들어가는 한 동작이다.
-- 클라이언트가 seller_id를 보내지 않게 하려고 서버가 posts에서 직접 읽는다.
--
-- security definer가 아니다. 4번의 chat_rooms_insert 정책을 그대로 통과해야 하고,
-- 아래 두 raise는 그 정책에 걸리기 전에 **왜 안 되는지**를 알려 주기 위한 것이다
-- (RLS는 이유를 말해 주지 않는다).
--
-- unique (post_id, buyer_id) 충돌은 오류가 아니라 "이미 있는 방"이다.
-- 연타로 두 번 눌러도 같은 방이 나와야 한다.
-- -----------------------------------------------------------------------------
create or replace function open_chat_room(p_post_id bigint)
returns bigint
language plpgsql
as $$
declare
  v_seller uuid;
  v_room   bigint;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = 'insufficient_privilege';
  end if;

  select seller_id into v_seller from posts where id = p_post_id;

  if v_seller is null then
    raise exception '게시물을 찾을 수 없습니다.' using errcode = 'no_data_found';
  end if;

  if v_seller = auth.uid() then
    raise exception '내 게시물에는 채팅을 걸 수 없습니다.' using errcode = 'check_violation';
  end if;

  select r.id into v_room
    from chat_rooms r
   where r.post_id = p_post_id and r.buyer_id = auth.uid();

  if v_room is not null then
    return v_room;
  end if;

  insert into chat_rooms (post_id, buyer_id, seller_id)
  values (p_post_id, auth.uid(), v_seller)
  returning id into v_room;

  return v_room;

exception
  when unique_violation then
    select r.id into v_room
      from chat_rooms r
     where r.post_id = p_post_id and r.buyer_id = auth.uid();
    return v_room;
end;
$$;

comment on function open_chat_room(bigint) is
  '게시물에 대한 나(구매자)와 판매자의 채팅방을 열어 id를 돌려준다. 이미 있으면 그 방을 준다. 자기 게시물에는 열 수 없다.';

-- -----------------------------------------------------------------------------
-- 11. 그 게시물에 채팅을 건 사람들
--
-- 예약자·구매자를 고르는 목록의 출처다. 2번의 posts_update 정책이 허용하는 집합과
-- 정확히 같아야 화면과 서버가 어긋나지 않는다.
-- 판매자 본인만 볼 수 있다 — 남의 글에 누가 문의했는지는 알 일이 아니다.
-- -----------------------------------------------------------------------------
create or replace function fetch_post_chat_partners(p_post_id bigint)
returns table (
  room_id      bigint,
  buyer_id     uuid,
  nickname     text,
  avatar_url   text,
  last_message_at timestamptz
)
language sql
stable
as $$
  select r.id, r.buyer_id, b.nickname, b.avatar_url, r.last_message_at
    from chat_rooms r
    join profiles b on b.id = r.buyer_id
    join posts p    on p.id = r.post_id
   where r.post_id = p_post_id
     and p.seller_id = auth.uid()
   order by coalesce(r.last_message_at, r.created_at) desc, r.id desc;
$$;

comment on function fetch_post_chat_partners(bigint) is
  '내 게시물에 채팅을 건 이웃 목록. 예약자·구매자를 고르는 후보이며 posts_update 정책이 허용하는 집합과 같다.';
