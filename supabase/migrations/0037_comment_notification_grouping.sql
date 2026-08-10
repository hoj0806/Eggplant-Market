-- =============================================================================
-- 0037. 같은 글의 댓글 알림을 한 줄로 묶는다
--
-- 0018은 댓글 하나에 알림 한 줄을 넣었다. 한 글에 댓글이 열 개 달리면 **알림도 열 줄**이고,
-- 그 열 줄이 전부 같은 곳을 가리킨다. 눌러도 같은 글, 지워도 같은 글이다.
--
-- 그래서 **받는 사람 × 글마다 한 줄**로 모은다. 새 댓글이 오면 그 줄을 새로 고친다.
--
--   미리보기 = 가장 최근 댓글
--   시각     = 가장 최근 댓글의 시각(목록에서 위로 올라온다)
--   개수     = payload의 comment_count
--
-- ── 왜 update가 되는가 ────────────────────────────────────────────────
-- 0036이 `notifications`의 update를 통째로 닫았다(정책·트리거를 지우고 select·delete만
-- 남겼다). 그런데 **그것은 사용자 경로다.** 알림을 넣는 트리거는 `security definer`라
-- 소유자 권한으로 돌고 RLS를 지나간다 — 0023이 매너온도에서 "시스템은 그대로 통과한다"고
-- 가른 것과 같은 자리다. 사용자는 여전히 알림을 **읽고 지우기만** 한다.
--
-- ── 왜 이게 지금 깔끔한가 ─────────────────────────────────────────────
-- 0036이 "누르면 지워진다"로 바꿔 둔 덕에 **묶음을 되돌릴 자리가 필요 없다.** 확인한 줄은
-- 그 순간 사라지고, 다음 댓글은 개수 1부터 새 줄로 시작한다. 읽음 상태가 남아 있었다면
-- "읽은 뒤에 온 댓글은 새 줄인가 같은 줄인가"를 정해야 했다.
--
-- ── 안 묶는 것 ────────────────────────────────────────────────────────
-- **찜(like)은 안 묶는다.** 같은 글에 여러 사람이 찜해도 한 사람이 여러 번은 못 한다
-- (0001의 unique). 사람마다 한 줄이 오히려 맞고, 묶으면 누가 찜했는지가 사라진다.
-- 채팅·가격 제안도 그대로다 — 그쪽은 방이 이미 묶음 노릇을 한다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 이미 쌓인 중복을 먼저 접는다
--
-- 0018이 댓글마다 한 줄을 넣어 두었으므로 **묶기 전의 줄들이 이미 여러 개**다.
-- 규칙만 바꾸고 두면 옛 줄은 영원히 안 접힌다. 가장 최근 것 하나만 남기고,
-- 그 줄의 개수를 접은 줄 수로 채운다.
-- -----------------------------------------------------------------------------
with grouped as (
  select id,
         user_id,
         (payload ->> 'post_id')::bigint as post_id,
         row_number() over (
           partition by user_id, (payload ->> 'post_id')::bigint
           order by created_at desc, id desc
         ) as rank_in_group,
         count(*) over (
           partition by user_id, (payload ->> 'post_id')::bigint
         ) as group_size
    from notifications
   where type = 'comment'
     and payload ? 'post_id'
)
update notifications n
   set payload = n.payload || jsonb_build_object('comment_count', g.group_size)
  from grouped g
 where n.id = g.id
   and g.rank_in_group = 1;

delete from notifications n
 using (
   select id,
          row_number() over (
            partition by user_id, (payload ->> 'post_id')::bigint
            order by created_at desc, id desc
          ) as rank_in_group
     from notifications
    where type = 'comment'
      and payload ? 'post_id'
 ) g
 where n.id = g.id
   and g.rank_in_group > 1;

-- -----------------------------------------------------------------------------
-- 2. 불변식을 DB가 지키게 한다
--
-- **함수에만 맡기면 안 된다.** 처음 이 마이그레이션을 밟을 때 update에 대상을 하나로
-- 좁히지 않아 **이미 있던 열네 줄을 전부 같은 값으로 덮었다** — 묶인 것이 아니라 복제됐다.
-- 실제 DB에 대고 확인하다 잡았다.
--
-- 규칙("받는 사람 × 글마다 댓글 알림 한 줄")을 부분 유일 인덱스로 못 박으면
--   ① 함수가 아무리 잘못 짜여도 두 줄이 될 수 없고
--   ② `on conflict`를 쓸 수 있어 **경합에도 안전**해진다
--      (인덱스가 없으면 동시에 온 댓글 둘이 나란히 insert를 시도해 하나가 죽는다).
-- -----------------------------------------------------------------------------
create unique index if not exists notifications_comment_per_post_idx
  on notifications (user_id, ((payload ->> 'post_id')::bigint))
  where type = 'comment';

-- -----------------------------------------------------------------------------
-- 3. 한 사람의 "이 글 댓글 알림"을 넣거나 새로 고친다
--
-- 비노출 `private` 스키마에 둔다. 트리거만 쓰는 것이고, 사용자가 부를 수 있으면
-- 남의 알림을 만드는 길이 된다(0014·0031·0033이 definer 함수를 그쪽에 둔 것과 같다).
--
-- `on conflict`라 **넣기와 새로 고치기가 한 문장**이다. row_count를 보고 갈래를 타면
-- 그 사이에 다른 트랜잭션이 끼어들 수 있다.
-- -----------------------------------------------------------------------------
create or replace function private.upsert_comment_notification(
  p_user_id uuid,
  p_post_id bigint,
  p_payload jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into notifications (user_id, type, payload)
  values (p_user_id, 'comment', p_payload || jsonb_build_object('comment_count', 1))
  on conflict (user_id, ((payload ->> 'post_id')::bigint)) where type = 'comment'
  do update
     -- 나머지 값은 최신 댓글로 덮고 개수만 올린다.
     set payload = excluded.payload || jsonb_build_object(
           'comment_count',
           coalesce((notifications.payload ->> 'comment_count')::integer, 1) + 1
         ),
         -- 목록에서 위로 올라오게 한다. 새 댓글이 왔는데 아래에 묻혀 있으면 묶은 뜻이 없다.
         created_at = now();
$$;

comment on function private.upsert_comment_notification(uuid, bigint, jsonb) is
  '받는 사람 × 글마다 댓글 알림 한 줄. 있으면 최신 댓글로 새로 고치고 개수를 올린다(0037).';

-- -----------------------------------------------------------------------------
-- 4. 트리거가 그 함수를 쓰게 한다
--
-- 판단(누구에게 알릴 것인가)은 0018 그대로다. 바뀐 것은 **넣는 방법**뿐이다.
-- -----------------------------------------------------------------------------
create or replace function notify_post_commented()
returns trigger
language plpgsql
security definer
set search_path = public
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
     and not private.is_blocked(new.author_id, v_seller)
     and private.wants_notification(v_seller, 'comment') then
    perform private.upsert_comment_notification(v_seller, new.post_id, v_payload);
  end if;

  if new.parent_id is not null then
    select c.author_id into v_parent from comments c where c.id = new.parent_id;

    if v_parent is not null
       and v_parent <> new.author_id
       and v_parent is distinct from v_seller
       and not private.is_blocked(new.author_id, v_parent)
       and private.wants_notification(v_parent, 'comment') then
      perform private.upsert_comment_notification(v_parent, new.post_id, v_payload);
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. 목록이 개수를 함께 준다
--
-- 반환 타입이 바뀌므로 drop이 먼저다(0036에서 같은 일을 했다).
-- 나머지는 그대로고 `comment_count` 한 칸만 늘었다 — 댓글이 아닌 알림은 1이다.
-- -----------------------------------------------------------------------------
drop function if exists fetch_notifications(timestamptz, bigint, integer);

create function fetch_notifications(
  p_cursor_at timestamptz default null,
  p_cursor_id bigint      default null,
  p_limit     integer     default 20
)
returns table (
  id               bigint,
  type             notification_type,
  created_at       timestamptz,
  actor_id         uuid,
  actor_nickname   text,
  actor_avatar_url text,
  room_id          bigint,
  post_id          bigint,
  post_title       text,
  preview          text,
  offer_amount     integer,
  is_first         boolean,
  comment_count    integer
)
language sql
stable
as $$
  select n.id,
         n.type,
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
         m.offer_amount,
         coalesce((n.payload ->> 'is_first')::boolean, false),
         coalesce((n.payload ->> 'comment_count')::integer, 1)
    from notifications n
    left join messages   m     on m.id  = (n.payload ->> 'message_id')::bigint
    left join chat_rooms cr    on cr.id = m.room_id
    left join reviews    rv    on rv.id = (n.payload ->> 'review_id')::bigint
    left join comments   c     on c.id  = (n.payload ->> 'comment_id')::bigint
    left join posts      p     on p.id  = coalesce(cr.post_id, rv.post_id,
                                                   (n.payload ->> 'post_id')::bigint)
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
  '내 알림 목록. payload의 id를 풀어 상대·게시물·미리보기까지 함께 주고 (created_at, id) keyset 페이징한다. 읽음 상태는 없고(0036) 댓글은 글마다 한 줄로 묶인다(0037).';
