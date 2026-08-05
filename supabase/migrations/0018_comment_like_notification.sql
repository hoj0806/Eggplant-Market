-- =============================================================================
-- 0018_comment_like_notification.sql — 댓글 · 찜 알림
--
-- `notification_type` enum(0001)에는 다섯 값이 다 있는데 `comment`·`like`를 **넣는 쪽이 없었다.**
-- 넣고 있던 것은 `on_message_insert`(chat/price_offer)와 `recalc_manner_temp`(review)뿐이다.
-- 0015가 읽는 쪽을 만들면서 두 타입도 함께 풀어 두었고(`fetch_notifications`),
-- 화면(`notificationText.ts`)도 두 타입의 문장을 이미 들고 있다. 남은 것이 트리거였다.
--
-- 댓글은 0017로 생겼고 찜은 0001부터 있었으므로 이제 둘 다 붙일 수 있다.
--
-- 트리거만 더하면 끝날 줄 알았는데 세 군데가 더 걸렸다. 0015가 두 타입을 "풀어 두었다"고 한 것은
-- **게시물과 미리보기까지**였고, 정작 **누가 했는가**는 풀리지 않는다.
--
--   ① 알림을 일으킨 사람(actor)을 `coalesce(m.sender_id, rv.reviewer_id)`로 찾는다.
--      댓글·찜에는 메시지도 후기도 없다 — 그대로 두면 전부 "알 수 없는 이웃님이"가 된다.
--   ② 미리보기가 메시지·후기만 본다. 댓글 내용이 들어갈 자리가 없다.
--   ③ `purge_blocked_notifications`가 message_id·review_id만 훑는다.
--      차단해도 그 사람의 댓글·찜 알림은 남는다.
--
-- 그래서 이 파일은 트리거 둘 + 읽는 쪽 보수 둘이다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. payload에 actor_id를 넣는다
--
-- 기존 세 타입은 payload에 사람을 담지 않았다. 담을 필요가 없었기 때문이다 —
-- 메시지에는 sender_id가, 후기에는 reviewer_id가 있어서 id 하나만 넣어 두면 사람까지 따라온다.
--
-- 찜은 그 길이 없다. `likes`의 기본키는 (user_id, post_id)라 **가리킬 id 자체가 없고**,
-- payload에 post_id만 넣으면 "누가 찜했는지"가 사라진다. 댓글은 comment_id로 따라갈 수 있지만
-- 댓글이 지워지면 그 길도 끊긴다.
--
-- 그래서 두 타입은 actor_id를 payload에 직접 넣는다. 아래 4번의 차단 청소도 이 칸 하나로
-- 끝나고, 앞으로 사람을 담는 타입이 늘어도 같은 칸을 쓰면 된다.
--
--   comment : {"post_id": 7, "comment_id": 12, "actor_id": "…"}
--   like    : {"post_id": 7,                   "actor_id": "…"}
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 2. 찜 알림
--
-- 자기 글은 애초에 찜할 수 없다(0006의 likes_insert). 그래도 트리거가 한 번 더 본다 —
-- 정책은 클라이언트 경로에만 걸리고, 이 함수는 definer라 시드·관리 작업에서도 돈다.
--
-- **차단을 여기서 본다.** 0014는 찜에 손대지 않았다. 차단해도 목록에서 글이 안 보일 뿐
-- 주소를 직접 치면 상세가 열리고 찜이 눌린다(0017의 댓글 쓰기와 같은 길이다).
-- 그 자리에서 알림까지 가면 "차단했는데 저쪽 이름이 계속 뜬다"가 된다.
-- `private.is_blocked`는 방향을 묻지 않으므로 누가 걸었든 막힌다.
--
-- **같은 사람이 같은 글을 다시 찜해도 알림은 한 번뿐이다.** 찜은 눌렀다 뗐다 할 수 있는
-- 버튼이라, 막지 않으면 두 번 누르는 것만으로 판매자에게 알림을 얼마든지 쌓을 수 있다.
-- 댓글과 다른 점이 이것이다 — 댓글은 누를 때마다 **새 내용**이 생기지만 찜은 같은 사실이
-- 되풀이될 뿐이라 두 번째부터는 알릴 것이 없다.
--
-- 읽었든 안 읽었든 다시 보내지 않는다. "이미 알렸다"가 기준이지 "아직 안 봤다"가 아니다.
-- -----------------------------------------------------------------------------
create or replace function notify_post_liked()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_seller uuid;
begin
  select p.seller_id into v_seller from posts p where p.id = new.post_id;

  if v_seller is null
  or v_seller = new.user_id
  or private.is_blocked(new.user_id, v_seller) then
    return new;
  end if;

  if exists (
    select 1
      from notifications n
     where n.type = 'like'
       and n.payload ->> 'post_id'  = new.post_id::text
       and n.payload ->> 'actor_id' = new.user_id::text
  ) then
    return new;
  end if;

  insert into notifications (user_id, type, payload)
  values (
    v_seller,
    'like',
    jsonb_build_object('post_id', new.post_id, 'actor_id', new.user_id)
  );

  return new;
end;
$$;

comment on function notify_post_liked is
  '찜이 생기면 판매자에게 알린다. 자기 글·차단 관계는 거르고, 같은 사람이 같은 글을 다시 찜해도 한 번만 알린다.';

drop trigger if exists likes_after_insert on likes;
create trigger likes_after_insert
  after insert on likes
  for each row execute function notify_post_liked();

-- 위 중복 확인 전용. 조건과 같은 모양으로 만들어 두지 않으면 알림 테이블 전체를 훑는다.
-- 부분 인덱스인 이유는 0015의 notifications_unread_idx와 같다 — 찜 알림은 전체의 일부다.
create index if not exists notifications_like_actor_idx
  on notifications ((payload ->> 'post_id'), (payload ->> 'actor_id'))
  where type = 'like';

-- -----------------------------------------------------------------------------
-- 3. 댓글 알림
--
-- 받는 사람이 둘 나올 수 있다.
--
--   ① 게시물 판매자 — 내 글에 댓글이 달렸다
--   ② 부모 댓글 작성자 — 내 댓글에 답이 달렸다 (parent_id가 있을 때)
--
-- ②는 지금 일어나지 않는다. 0017이 1단 댓글까지만 만들었고 `parent_id`를 채우는 화면이 없다.
-- 그래도 여기 두는 이유는, 대댓글이 붙는 날 **화면만 만들면 알림이 따라오게** 하기 위해서다.
-- 트리거를 다시 열어 고치는 것보다 지금 여섯 줄을 두는 편이 싸고, 지금도 SQL로 직접 넣어
-- 동작을 확인할 수 있다.
--
-- 겹치는 경우를 셋 거른다.
--
--   - 자기 글에 자기가 단 댓글      : 판매자 = 작성자
--   - 자기 댓글에 자기가 단 답글    : 부모 작성자 = 작성자
--   - 판매자가 부모 댓글을 쓴 경우  : 한 사람에게 같은 알림이 두 번 간다
--
-- 차단은 판매자 쪽은 이미 0017의 `comments_insert`가 막고 있지만(차단한 사람 글에는 못 쓴다)
-- **부모 댓글 작성자는 그 정책이 보지 않는다.** 정책은 글쓴이만 본다. 그래서 여기서 둘 다 본다.
-- 찜과 마찬가지로 정책에 기대지 않고 트리거가 스스로 확인하는 편이 definer 함수답다.
--
-- 찜과 달리 중복을 막지 않는다. 댓글은 누를 때마다 새 내용이 생기므로 매번 알릴 것이 있다.
-- -----------------------------------------------------------------------------
create or replace function notify_post_commented()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_seller  uuid;
  v_parent  uuid;
  v_payload jsonb;
begin
  select p.seller_id into v_seller from posts p where p.id = new.post_id;

  v_payload := jsonb_build_object(
    'post_id',    new.post_id,
    'comment_id', new.id,
    'actor_id',   new.author_id
  );

  if v_seller is not null
     and v_seller <> new.author_id
     and not private.is_blocked(new.author_id, v_seller) then
    insert into notifications (user_id, type, payload)
    values (v_seller, 'comment', v_payload);
  end if;

  if new.parent_id is not null then
    select c.author_id into v_parent from comments c where c.id = new.parent_id;

    if v_parent is not null
       and v_parent <> new.author_id
       and v_parent is distinct from v_seller
       and not private.is_blocked(new.author_id, v_parent) then
      insert into notifications (user_id, type, payload)
      values (v_parent, 'comment', v_payload);
    end if;
  end if;

  return new;
end;
$$;

comment on function notify_post_commented is
  '댓글이 달리면 판매자에게, 대댓글이면 부모 댓글 작성자에게도 알린다. 본인·중복·차단은 거른다.';

drop trigger if exists comments_after_insert on comments;
create trigger comments_after_insert
  after insert on comments
  for each row execute function notify_post_commented();

-- -----------------------------------------------------------------------------
-- 4. 읽는 쪽 — actor와 미리보기에 두 타입을 더한다
--
-- 0015의 본문을 그대로 두고 두 줄을 고친다. 시그니처가 같아 create or replace로 교체된다.
--
--   actor  : coalesce의 마지막 갈래로 payload의 actor_id를 넣는다. 앞의 둘이 비었을 때만
--            쓰이므로 기존 세 타입은 아무것도 달라지지 않는다.
--   preview: 댓글 내용을 더한다. 찜은 미리보기가 없다 — 화면이 글 제목을 대신 쓴다
--            (`notificationText`의 like 갈래).
--
-- `post_id`는 손댈 것이 없다. 0015의 coalesce가 이미 세 번째 갈래로 payload의 post_id를 본다.
--
-- comments를 join해도 `security invoker`라 0017의 `comments_select`가 그대로 걸린다.
-- 차단한 사람의 댓글은 내용이 null로 비고 화면은 글 제목으로 물러선다 —
-- 4번이 지우고 남는 틈(차단 이전에 이미 읽은 알림 등)에서도 문장이 깨지지 않는다.
--
-- 댓글이 지워지면 미리보기만 사라지고 알림 줄은 남는다. 글로는 여전히 갈 수 있으므로
-- 눌러도 소용없는 줄은 되지 않는다.
-- -----------------------------------------------------------------------------
create or replace function fetch_notifications(
  p_cursor_at timestamptz default null,
  p_cursor_id bigint      default null,
  p_limit     integer     default 20
)
returns table (
  id               bigint,
  type             notification_type,
  is_read          boolean,
  created_at       timestamptz,
  actor_id         uuid,
  actor_nickname   text,
  actor_avatar_url text,
  room_id          bigint,
  post_id          bigint,
  post_title       text,
  preview          text,
  offer_amount     integer
)
language sql
stable
as $$
  select n.id,
         n.type,
         n.is_read,
         n.created_at,
         actor.id,
         actor.nickname,
         actor.avatar_url,
         m.room_id,
         p.id,
         p.title,
         -- 미리보기. 사진은 경로가 들어 있으므로(0008) 그대로 보이면 안 된다.
         case
           when m.id is not null then
             case when m.type = 'image' then '사진을 보냈어요' else m.content end
           when rv.id is not null then rv.comment
           when c.id  is not null then c.content
           else null
         end,
         m.offer_amount
    from notifications n
    -- payload에 그 키가 없으면 ->> 가 null을 주고 join이 비어 남는다. 타입별 분기가 따로 필요 없다.
    left join messages   m     on m.id  = (n.payload ->> 'message_id')::bigint
    left join chat_rooms cr    on cr.id = m.room_id
    left join reviews    rv    on rv.id = (n.payload ->> 'review_id')::bigint
    left join comments   c     on c.id  = (n.payload ->> 'comment_id')::bigint
    -- 게시물은 세 갈래로 온다: 채팅이면 방이 물고 있고, 후기면 후기가 물고 있고,
    -- 댓글·찜이면 payload에 직접 들어 있다(0018).
    left join posts      p     on p.id  = coalesce(cr.post_id, rv.post_id,
                                                   (n.payload ->> 'post_id')::bigint)
    -- 댓글·찜은 메시지도 후기도 없어 payload의 actor_id로만 사람을 찾는다(0018의 1번).
    left join profiles   actor on actor.id = coalesce(m.sender_id, rv.reviewer_id,
                                                      (n.payload ->> 'actor_id')::uuid)
   where n.user_id = auth.uid()
     and (
       p_cursor_at is null
       or n.created_at < p_cursor_at
       or (n.created_at = p_cursor_at and n.id < coalesce(p_cursor_id, 0))
     )
   order by n.created_at desc, n.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function fetch_notifications(timestamptz, bigint, integer) is
  '내 알림 목록. payload의 id를 풀어 상대·게시물·미리보기까지 함께 주고 (created_at, id) keyset 페이징한다.';

-- -----------------------------------------------------------------------------
-- 5. 차단 청소가 댓글·찜 알림도 훑게 한다
--
-- 0015의 5번은 message_id와 review_id를 각각 join해 "그 사람이 보낸 것인가"를 물었다.
-- 그때는 사람이 payload에 없어 메시지·후기를 거쳐 갈 수밖에 없었다.
--
-- 이제 두 타입은 actor_id를 직접 들고 있으므로 갈래를 하나 더 붙인다 —
-- **타입을 묻지 않는다.** payload에 actor_id가 있으면 그것이 곧 알림을 일으킨 사람이다.
-- 앞으로 사람을 담는 타입이 늘어도 이 갈래가 그대로 받는다.
--
-- `<> n.user_id`는 기존 두 갈래와 같은 이유다 — 지우려는 것은 **상대에게서 온** 알림이지
-- 내가 일으킨 알림이 아니다. 다만 지금은 자기 자신에게 가는 알림이 만들어지지 않으므로
-- (2·3번이 본인을 거른다) 실제로 걸릴 일은 없다. 조건을 맞춰 두는 쪽이 읽기 쉽다.
--
-- 지우고 나면 4번이 join하던 댓글은 그대로 남는다. 알림만 사라지고 댓글 자체는 건드리지 않는다 —
-- 차단은 "안 보이게 하는 것"이고(0014), 0017의 `comments_select`가 목록에서 이미 감춘다.
-- -----------------------------------------------------------------------------
create or replace function purge_blocked_notifications()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from notifications n
   where n.user_id in (new.blocker_id, new.blocked_id)
     and (
       exists (
         select 1 from messages m
          where m.id = (n.payload ->> 'message_id')::bigint
            and m.sender_id in (new.blocker_id, new.blocked_id)
            and m.sender_id <> n.user_id
       )
       or exists (
         select 1 from reviews r
          where r.id = (n.payload ->> 'review_id')::bigint
            and r.reviewer_id in (new.blocker_id, new.blocked_id)
            and r.reviewer_id <> n.user_id
       )
       or (
         (n.payload ->> 'actor_id')::uuid in (new.blocker_id, new.blocked_id)
         and (n.payload ->> 'actor_id')::uuid <> n.user_id
       )
     );

  return new;
end;
$$;

comment on function purge_blocked_notifications is
  '차단이 생기면 두 사람 사이에서 오간 알림을 양쪽에서 지운다. 목록만 걸러 내면 배지 숫자와 어긋난다.';
