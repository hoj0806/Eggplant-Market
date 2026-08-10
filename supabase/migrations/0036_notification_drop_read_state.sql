-- =============================================================================
-- 0036. 알림에서 "읽음"이라는 상태를 없앤다
--
-- 규칙이 하나로 바뀌었다: **알림은 읽는 것이 아니라 치우는 것이다.**
--
--   누르면  → 가리키던 곳으로 가고 **그 줄은 사라진다**
--   ×       → 안 열고 그냥 사라진다
--   모두 삭제 → 전부 사라진다
--
-- 그래서 `is_read`가 답할 질문이 남지 않는다. 남은 줄은 전부 "아직 안 치운 것"이고,
-- 종 배지가 세는 것도 그것이다.
--
-- **왜 컬럼까지 지우나.** 안 쓰는 칸을 남겨 두면 다음에 읽는 사람이 "왜 있지"를 묻는다.
-- 더 나쁜 것은 0001의 `notifications_update` 정책이 그대로 열려 있는 상태다 —
-- 아무도 안 부르는 update 경로가 열려 있으면, 그 위에 무엇을 얹어도 되는 줄 알게 된다.
-- 0015가 `guard_notification_update`를 붙여 지키려던 것("알림이 가리키는 대상이 사후에
-- 바뀌지 않는다")은 **update 자체를 닫으면 더 확실하게 지켜진다.**
--
-- 이제 알림에 허용되는 명령은 **select와 delete 둘뿐**이다.
--
-- 딸려서 정리되는 것
--   - `count_unread_notifications()`  : 배지가 "남은 수"를 세게 되어 안 쓴다.
--                                       화면이 평범한 count로 세고 범위는 RLS가 정한다.
--   - `notifications_unread_idx`      : 그 count 전용 부분 인덱스였다.
--   - `fetch_notifications`           : 반환 표에서 is_read를 뺀다(반환 타입이 바뀌므로
--                                       create or replace가 아니라 drop 후 create다).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. update를 통째로 닫는다
--
-- 정책을 지우면 update는 "막힌다"가 아니라 **대상 행이 없다**가 된다(RLS 기본값).
-- 트리거는 그 뒤에 설 자리가 없으므로 함께 걷는다.
-- -----------------------------------------------------------------------------
drop policy  if exists notifications_update      on notifications;
drop trigger if exists notifications_guard_update on notifications;
drop function if exists guard_notification_update();

-- -----------------------------------------------------------------------------
-- 2. 안 읽은 수를 세던 것들
-- -----------------------------------------------------------------------------
drop function if exists count_unread_notifications();
drop index    if exists notifications_unread_idx;

-- -----------------------------------------------------------------------------
-- 3. 목록에서 is_read를 뺀다
--
-- 반환 타입이 바뀌므로 drop이 먼저다. 나머지는 0021까지 온 정의 그대로다.
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
  is_first         boolean
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
         coalesce((n.payload ->> 'is_first')::boolean, false)
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
  '내 알림 목록. payload의 id를 풀어 상대·게시물·미리보기까지 함께 주고 (created_at, id) keyset 페이징한다. 읽음 상태는 없다(0036).';

-- -----------------------------------------------------------------------------
-- 4. 칸을 지운다
--
-- 마지막이다. 위의 함수들이 이 칸을 보고 있어서 순서를 바꾸면 의존성에 걸린다.
-- 쌓여 있던 값은 버린다 — "읽었나"는 이제 아무도 묻지 않는 질문이다.
-- -----------------------------------------------------------------------------
alter table notifications drop column if exists is_read;

comment on table notifications is
  '내게 온 알림. 트리거가 넣고 사람이 지운다. 읽음 상태는 없다 — 누르면 지워진다(0036).';
