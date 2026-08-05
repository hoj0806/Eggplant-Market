-- =============================================================================
-- 0021_first_review.sql — 첫 거래 안내
--
-- `backlog.md` §4 "첫 거래 안내 (5단계) — '첫 후기를 받았어요' 같은 축하 화면.
-- **지금은 온도만 조용히 오른다.**"
--
-- 마지막 문장이 문제의 전부다. 첫 후기를 받으면 `manner_temp`가 36.5°에서 움직이는데,
-- 그 사실을 어디서도 말해 주지 않는다. 프로필에 들어가 눈금을 봐야 안다.
--
-- **축하 화면(모달)을 만들지 않았다.** 모달은 "이미 봤는가"를 어딘가 적어 둬야 하는데,
-- 그 자리가 지금 없다 — profiles에 칸을 하나 더하거나 기기에 저장해야 한다.
-- **알림은 그 상태를 이미 갖고 있다**(`is_read`). 게다가 첫 후기 알림은 이미 가고 있었고
-- (0001의 `recalc_manner_temp`), 다른 후기와 구별되지 않았을 뿐이다.
-- 그래서 새 통로를 파지 않고 이미 가고 있는 줄에 표를 붙인다.
--
--   1. 첫 후기이면 payload에 표를 남긴다
--   2. fetch_notifications가 그 표를 화면까지 내려 준다
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 첫 후기에 표를 남긴다
--
-- 트리거가 `after insert`라(0001) 이 시점에 새 행은 이미 세어진다 — 그래서 `count(*) = 1`이
-- 곧 "이번이 처음"이다.
--
-- **"처음 받아 본 적 있는가"가 아니라 "지금 한 건인가"를 묻는다.** 첫 후기를 쓴 사람이
-- 탈퇴하면 그 후기가 cascade로 사라지고(0016의 ②), 다음 후기가 다시 "첫 후기"가 된다.
-- 그것을 막지 않는 이유는 0016이 온도를 다루는 방식과 같다 — **증감을 누적하지 않고
-- 매번 현재 사실로 되짚는다.** 실제로 그 사람이 지금 가진 후기는 그 한 건뿐이고,
-- 프로필에도 "받은 후기 1"로 보인다. 여기서만 "두 번째"라고 하면 그쪽과 어긋난다.
--
-- 막으려면 "축하를 보낸 적 있다"를 profiles에 적어야 하는데, 그것이 위에서 피한 바로 그
-- 칸이다. 아주 드문 경우에 축하가 한 번 더 가는 쪽이 칸 하나를 늘리는 쪽보다 싸다.
--
-- 온도 값은 payload에 담지 않는다. 화면이 눌러서 가는 곳이 자기 프로필이라(0015의
-- notificationText) 거기에 지금 온도가 눈금으로 있다. 담아 두면 그 숫자는 **찍힌 순간의 값**이라
-- 나중에 프로필과 다른 값을 보이게 된다.
-- -----------------------------------------------------------------------------
create or replace function recalc_manner_temp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_first boolean;
begin
  perform sync_manner_temp(new.reviewee_id);

  select count(*) = 1 into v_is_first
    from reviews r
   where r.reviewee_id = new.reviewee_id;

  insert into notifications (user_id, type, payload)
  values (
    new.reviewee_id,
    'review',
    jsonb_build_object(
      'post_id',   new.post_id,
      'review_id', new.id,
      'is_first',  v_is_first
    )
  );

  return new;
end;
$$;

comment on function recalc_manner_temp is
  '후기가 들어오면 매너온도를 다시 계산하고 알림을 넣는다. 그 사람의 첫 후기이면 payload에 is_first를 남긴다(0021).';

-- 이미 쌓인 후기 알림에는 이 표가 없다. `->>`가 null을 주고 아래 2번이 false로 세우므로
-- 옛 알림은 지금까지와 똑같이 보인다. 되짚어 채우지 않는 이유는 **축하는 그때 하는 것**이라서다
-- (0015가 차단 해제에 대해, 0018이 찜 취소에 대해 정한 것과 같은 결).

-- -----------------------------------------------------------------------------
-- 2. 읽는 쪽 — 표를 화면까지 내려 준다
--
-- `create or replace`로는 안 된다. 반환 컬럼이 늘면 시그니처가 달라져 replace가 거절한다.
-- drop 후 create라 잠깐 함수가 없는 순간이 생기지만, 마이그레이션 한 트랜잭션 안이라
-- 밖에서는 그 순간을 볼 수 없다.
--
-- **본문은 0018이 만든 것 그대로다.** 컬럼 하나와 select 한 줄만 늘었다.
--
-- `coalesce(..., false)`로 세운다. 다른 네 타입의 payload에는 이 키가 없어 `->>`가 null을
-- 주는데, 그대로 내려보내면 화면이 "모르는 값"과 "첫 후기가 아님"을 가려야 한다.
-- 서버가 여기서 하나로 정리하는 편이 0015가 payload를 풀어 주기로 한 판단과 같은 결이다.
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
  is_read          boolean,
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
         m.offer_amount,
         -- 첫 후기 표식(0021). 다른 타입에는 이 키가 없어 null이 오므로 false로 세운다.
         coalesce((n.payload ->> 'is_first')::boolean, false)
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
  '내 알림 목록. payload의 id를 풀어 상대·게시물·미리보기·첫 후기 여부까지 함께 주고 (created_at, id) keyset 페이징한다.';
