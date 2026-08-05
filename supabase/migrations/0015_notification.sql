-- =============================================================================
-- 알림
--
-- 0001부터 `notifications` 테이블과 정책이 있었고, 트리거 둘(`on_message_insert`,
-- `recalc_manner_temp`)이 **이미 행을 쌓고 있었다.** 없던 것은 읽는 쪽이다 —
-- 채팅·가격제안·후기 알림이 쌓이기만 하고 아무도 보지 않았다.
--
-- 그래서 이 파일은 새 알림을 만드는 일이 아니라 **쌓인 것을 꺼내 쓸 수 있게 하는 일**이다.
--   1. Realtime publication에 notifications를 넣는다 (0008이 messages·chat_rooms만 넣었다)
--   2. update에서 is_read 말고는 못 바꾸게 막는다 (messages의 guard_message_update와 같은 자리)
--   3. payload의 id를 풀어 화면이 바로 그릴 수 있는 모양으로 내려주는 fetch_notifications
--   4. 안 읽은 수 count_unread_notifications
--   5. 차단하면 그 사람에게서 온 알림도 함께 지운다
--
-- `notification_type` enum에는 `comment`·`like`도 있지만 **이 값을 넣는 트리거는 아직 없다.**
-- 댓글·찜은 아직 기능 자체가 없어서다. 아래 3번은 두 타입도 함께 풀어 두었다 —
-- 나중에 트리거만 더하면 화면은 그대로 굴러간다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Realtime
--
-- 0008이 `supabase_realtime`에 messages·chat_rooms를 넣었지만 notifications는 빠져 있었다.
-- 넣지 않으면 구독은 조용히 성공하고 이벤트만 영원히 오지 않는다 — 실패로 보이지 않아
-- 더 찾기 어려운 종류의 누락이다.
--
-- `replica identity full`은 걸지 않는다. 그것이 필요한 것은 update의 **이전 행**을 볼 때인데
-- (messages의 읽음 표시가 그랬다), 알림은 insert만 구독한다. 읽음 표시는 누른 본인의 화면에서
-- 일어나므로 캐시를 그 자리에서 고치면 되고 서버가 되돌려 줄 이유가 없다.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. update는 읽음 표시만
--
-- 0001의 `notifications_update`는 `auth.uid() = user_id` 하나뿐이다. 내 알림이면 **무엇이든**
-- 바꿀 수 있다는 뜻이라, 마음먹으면 남이 보낸 알림의 문구 근거가 되는 payload를 바꿔치기할 수 있다.
--
-- messages에 `guard_message_update`(0008)를 둔 것과 같은 이유로 여기도 컬럼을 잠근다.
-- 화면이 보내는 update는 `is_read` 하나뿐이므로 잃는 것이 없다.
-- -----------------------------------------------------------------------------
create or replace function guard_notification_update()
returns trigger
language plpgsql
as $$
begin
  if new.user_id    is distinct from old.user_id
  or new.type       is distinct from old.type
  or new.payload    is distinct from old.payload
  or new.created_at is distinct from old.created_at then
    raise exception '알림은 읽음 표시만 바꿀 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function guard_notification_update is
  '알림 update에서 is_read 외의 컬럼 변경을 막는다. 알림이 가리키는 대상이 사후에 바뀌지 않게 하는 자리.';

drop trigger if exists notifications_guard_update on notifications;
create trigger notifications_guard_update
  before update on notifications
  for each row execute function guard_notification_update();

-- -----------------------------------------------------------------------------
-- 3. 알림 목록 — payload를 화면이 쓸 모양으로 푼다
--
-- payload에 들어 있는 것은 id뿐이다.
--
--   chat · price_offer : {"room_id": 12, "message_id": 340}
--   review             : {"post_id": 7, "review_id": 3}
--
-- 이대로 내려보내면 화면이 알림 한 줄마다 메시지·방·후기·프로필을 따로 조회하게 된다.
-- 스무 줄이면 조회 수십 번이다. 그래서 서버가 한 번에 풀어서 준다 — 0009의 마이페이지 목록,
-- 0013의 `fetch_user_reviews`가 제목·닉네임을 함께 내려준 것과 같은 판단이다.
--
-- `security invoker`(기본)로 둔다. join하는 messages·chat_rooms에 각자의 select 정책이
-- 그대로 걸리는데, 알림을 받은 사람은 그 방의 참여자이므로 통과한다. definer로 올려서
-- 정책을 우회할 이유가 없고, 우회하지 않는 편이 안전하다.
--
-- 커서는 `(created_at, id)`다. 같은 초에 알림이 둘 이상 들어올 수 있어(메시지 연달아 보내기)
-- created_at만으로는 페이지 경계에서 행이 새거나 겹친다 — 0013과 같은 이유, 같은 모양.
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
           else null
         end,
         m.offer_amount
    from notifications n
    -- payload에 그 키가 없으면 ->> 가 null을 주고 join이 비어 남는다. 타입별 분기가 따로 필요 없다.
    left join messages   m     on m.id  = (n.payload ->> 'message_id')::bigint
    left join chat_rooms cr    on cr.id = m.room_id
    left join reviews    rv    on rv.id = (n.payload ->> 'review_id')::bigint
    -- 게시물은 세 갈래로 온다: 채팅이면 방이 물고 있고, 후기면 후기가 물고 있고,
    -- 댓글·찜(아직 트리거 없음)이면 payload에 직접 들어올 것이다.
    left join posts      p     on p.id  = coalesce(cr.post_id, rv.post_id,
                                                   (n.payload ->> 'post_id')::bigint)
    left join profiles   actor on actor.id = coalesce(m.sender_id, rv.reviewer_id)
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
-- 4. 안 읽은 수
--
-- 배지 하나를 위해 목록 전체를 받아 세지 않는다. 채팅 배지가 `fetch_chat_rooms`를 그대로
-- 나눠 쓴 것(useUnreadChatCount)과 다른 선택인데, 그쪽은 배지와 **목록 화면이 같은 쿼리**라
-- 캐시를 나눠 쓰는 이득이 있었다. 알림은 배지가 홈 헤더에, 목록은 다른 화면에 있고
-- 목록은 무한 스크롤이라 "전부 받아서 세기"가 애초에 불가능하다.
-- -----------------------------------------------------------------------------
create or replace function count_unread_notifications()
returns integer
language sql
stable
as $$
  select count(*)::integer
    from notifications
   where user_id = auth.uid()
     and is_read = false;
$$;

comment on function count_unread_notifications() is
  '내 안 읽은 알림 수. 홈 헤더 배지가 쓴다.';

-- 위 count 전용. 0001의 notifications_user_idx는 (user_id, created_at desc)라 3번의
-- 정렬은 덮지만 "안 읽은 것만"은 걸러 낸 뒤에야 세게 된다. 부분 인덱스가 훨씬 작다
-- (읽은 알림이 대부분을 차지하므로 — messages_unread_idx가 0008에서 같은 이유로 생겼다).
create index if not exists notifications_unread_idx
  on notifications (user_id)
  where is_read = false;

-- -----------------------------------------------------------------------------
-- 5. 차단하면 그 사람에게서 온 알림도 지운다
--
-- 0014는 차단을 "안 보이게 하는 것"으로 정하고 목록 넷에서 걸러 냈다. 알림도 같은 대상인데,
-- 여기서는 **거르는 것만으로 부족하다** — 목록에서만 빼면 배지는 3을 가리키는데 열어 보면
-- 한 줄뿐인 화면이 된다. 배지는 4번처럼 단순히 세야 값이 싸고, 목록은 걸러야 하니
-- 둘이 어긋난다.
--
-- 그래서 목록에 필터를 다는 대신 **차단하는 순간 지운다.** 차단당한 쪽의 알림도 함께 지운다 —
-- 0014의 `fetch_chat_rooms`가 양방향으로 방을 감추므로, 한쪽에만 알림이 남으면 눌러도
-- 갈 곳이 없는 알림이 된다.
--
-- 해제해도 지난 알림은 돌아오지 않는다. 알림은 원래 "그때 알려 주는 것"이라 되돌릴 값이 아니고,
-- 방과 대화는 0014대로 그대로 돌아온다.
--
-- `security definer`인 이유: notifications에는 delete 정책이 아예 없다(0001). 본인 알림을
-- 지우는 길을 클라이언트에 열어 줄 생각이 없어서 정책을 더하지 않고 이 트리거 안에서만 지운다.
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
     );

  return new;
end;
$$;

comment on function purge_blocked_notifications is
  '차단이 생기면 두 사람 사이에서 오간 알림을 양쪽에서 지운다. 목록만 걸러 내면 배지 숫자와 어긋난다.';

drop trigger if exists blocks_after_insert on blocks;
create trigger blocks_after_insert
  after insert on blocks
  for each row execute function purge_blocked_notifications();
