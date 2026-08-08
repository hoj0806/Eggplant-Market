-- =============================================================================
-- 0030_chat_room_leave.sql — 채팅방 나가기
--
-- `backlog.md` §4의 나머지 절반. 그 항목이 "`chat_rooms`에 칸이 필요할 수 있어 §5로 넘어갈
-- 소지가 있다"고 적어 둔 자리인데, **칸은 붙지만 결정은 하나뿐이라 §4에 남았다.**
--
-- -----------------------------------------------------------------------------
-- 정한 것: 목록에서만 감춘다
--
-- 나가기는 **내 목록에서 이 방을 치우는 일**이다. 대화도 방도 지우지 않고 상대 화면은
-- 그대로다. 지우는 쪽으로 열면 한쪽이 누른 것으로 상대의 대화까지 사라지는데, 그것은
-- 0008이 "대화 기록이 사후에 바뀌면 채팅을 신뢰할 수 없다"고 정한 선을 넘는다.
--
-- **상대가 다시 말을 걸면 돌아온다.** 안 돌아오게 하려면 나간 사람에게만 메시지가 닿지
-- 않아야 하는데, 그것은 나가기가 아니라 차단(0014)이 하는 일이다. 둘이 같은 동작이 되면
-- 차단의 무게가 가벼워진다.
--
-- -----------------------------------------------------------------------------
-- 칸 둘, 테이블 하나가 아닌 이유
--
-- 참여자가 정확히 둘로 고정된 테이블이다(`unique (post_id, buyer_id)`, 1:1). 방 하나에
-- 사람이 늘 수 없으므로 `chat_room_hidden(room_id, user_id)` 같은 테이블을 두면 조인 하나가
-- 늘 뿐이고, 늘어난 자유도("셋째 사람이 나갔다")는 표현할 데가 없는 상태다.
-- 0022가 알림 설정에서 jsonb 한 칸 대신 칸 셋을 고른 것과 같은 판단이다.
--
-- 시각을 적는다(boolean이 아니다). 다시 나타날 조건이 **"나간 뒤에 온 말이 있는가"**라
-- 언제 나갔는지를 알아야 한다.
-- =============================================================================

alter table chat_rooms
  add column if not exists buyer_left_at  timestamptz,
  add column if not exists seller_left_at timestamptz;

comment on column chat_rooms.buyer_left_at is
  '구매자가 이 방을 나간 시각. 대화는 남고 구매자의 목록에서만 빠진다. 그 뒤에 온 메시지가 있으면 다시 나타난다(0030).';
comment on column chat_rooms.seller_left_at is
  '판매자가 이 방을 나간 시각. 구매자 쪽과 서로 무관하다(0030).';

-- -----------------------------------------------------------------------------
-- 1. 나가기 — 함수가 유일한 문이다
--
-- `chat_rooms`에는 update 정책이 없다(0001에 select·insert만 있다). 여기서 정책을 새로
-- 열면 `last_message`·`last_message_at`까지 함께 열리고, 그러면 "무엇을"을 지킬 트리거가
-- 하나 더 필요해진다 — 0008이 messages에서 정책+트리거로 나눠야 했던 그 짐이다.
--
-- 그 짐을 지지 않는 길이 있다. **문을 정책이 아니라 함수로 내는 것**이다. security definer라
-- RLS를 지나가고, 이 함수가 쓰는 칸은 두 개뿐이라 트리거로 지킬 것이 없다.
-- (0008의 open_chat_room이 definer가 **아닌** 것과 반대 방향인데, 그쪽은 반대로 정책을
-- 그대로 태워야 했다 — insert 정책이 이미 규칙을 들고 있었기 때문이다.)
--
-- definer는 RLS를 지나가므로 "내가 이 방 사람인가"를 스스로 확인해야 한다. 그 판단이
-- 함수 안에 적혀 있다는 것이 이 방식의 값이자 대가다.
--
-- 이미 나간 방을 또 나가도 오류가 아니다 — 시각만 지금으로 밀린다. 나간 사람에게는 이 방이
-- 목록에 없어 두 번 누를 길이 애초에 없고, 있다 해도 결과가 같아야 할 동작이다.
-- -----------------------------------------------------------------------------
create or replace function leave_chat_room(p_room_id bigint)
returns void
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
end;
$$;

comment on function leave_chat_room(bigint) is
  '이 방을 내 채팅 목록에서 치운다. 대화도 방도 지우지 않고 상대 화면은 그대로다. '
  '나간 뒤에 메시지가 오면 목록에 다시 나타난다(0030).';

-- -----------------------------------------------------------------------------
-- 2. 목록에서 빼기 — 그리고 되돌아오기
--
-- 조건 한 줄이다.
--
--   나간 적이 없거나(null), 나간 뒤에 온 말이 있으면 보인다
--
-- 이 한 줄이 "상대가 다시 말을 걸면 돌아온다"까지 함께 해결한다. 되살리는 트리거를 따로
-- 두면 "메시지가 들어올 때 상대의 left_at을 지운다"를 on_message_insert에 얹게 되는데,
-- 그 함수는 이미 요약·알림 둘을 하고 있고 셋째 일이 붙을 이유가 없다.
--
-- **내가 보낸 말도 나를 돌아오게 한다.** 나간 방에 다시 글을 쓰는 길은 게시물 상세의
-- "채팅하기"뿐인데(open_chat_room이 있던 방을 그대로 돌려준다), 그렇게 들어가 말을 걸었다면
-- 그 방은 다시 내 목록에 있어야 맞다.
--
-- 부등호는 `>`다. 같은 시각은 "나간 뒤"가 아니다. `now()`가 **트랜잭션 시작 시각**이라
-- 나가기와 메시지가 한 트랜잭션에 있으면 두 값이 정확히 같아지는데, 그 상황은 요청이
-- 나뉘는 실제 동선에는 없다(테스트를 한 트랜잭션에서 밟다 이 값이 같아지는 것을 봤다).
-- 밀리초 단위로 겹쳐 방이 한 번 안 돌아오더라도 **다음 메시지에 돌아온다** — 되돌릴 수
-- 없는 종류의 어긋남이 아니라서 시각 비교로 충분하다.
--
-- 인자가 하나 붙는다. 방 **하나**를 여는 화면은 나간 방도 열 수 있어야 하기 때문이다 —
-- 0024가 반경 검색에서 "기준을 함수가 아니라 인자로 갈랐다"고 한 것과 같은 이유다.
-- 함수를 둘로 쪼개면 여기 쌓인 규칙(차단 0014 · 안 읽은 수 0029 · 상대 고르기 0008)을
-- 두 벌 유지하게 된다.
--
-- 기본값이 `false`라 클라이언트의 `rpc('fetch_chat_rooms')`는 인자 없이 그대로 부른다.
-- 다만 **기본값을 더하는 것만으로는 안 된다** — 0인자 함수가 남아 있으면 호출이 모호해진다.
-- 그래서 드롭하고 다시 만든다(fetch_chat_room이 이 함수에 매달려 있어 함께 간다).
-- -----------------------------------------------------------------------------
drop function if exists fetch_chat_room(bigint);
drop function if exists fetch_chat_rooms();

create or replace function fetch_chat_rooms(p_include_left boolean default false)
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
         -- 지운 메시지는 읽을 것이 없다(0029).
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
     -- 내가 나간 방은 그 뒤에 온 말이 있을 때만 돌아온다(0030).
     and (
       p_include_left
       or (case when r.buyer_id = auth.uid() then r.buyer_left_at else r.seller_left_at end) is null
       or coalesce(r.last_message_at, r.created_at)
          > (case when r.buyer_id = auth.uid() then r.buyer_left_at else r.seller_left_at end)
     )
   order by coalesce(r.last_message_at, r.created_at) desc, r.id desc;
$$;

comment on function fetch_chat_rooms(boolean) is
  '내가 참여한 채팅방 목록. 상대 프로필·게시물 요약·마지막 메시지·안 읽은 수를 한 번에 돌려준다. '
  '차단 관계에 있는 상대의 방은 빠지고(0014), 지운 메시지는 안 읽은 수에 들어가지 않으며(0029), '
  '내가 나간 방은 그 뒤에 온 말이 있을 때만 보인다(0030).';

-- -----------------------------------------------------------------------------
-- 3. 방 하나 — 나간 방도 열린다
--
-- `p_include_left => true`다. 나가기는 **목록에서 치우는 일**이라고 정했으므로, 주소를 아는
-- 방이 열리지 않을 이유가 없다. 실제로 열려야 하는 자리도 있다 — 나간 뒤 게시물 상세에서
-- "채팅하기"를 누르면 0008의 open_chat_room이 있던 방 id를 그대로 돌려주는데,
-- 여기서 걸러 버리면 그 길이 "채팅방을 찾을 수 없습니다"로 끝난다.
--
-- 차단은 다르다. 그쪽은 여기서도 막혀야 해서 0014가 목록 조건에 넣어 두었고(주소로도 안
-- 열린다), 이 인자는 그 조건에 손대지 않는다.
-- -----------------------------------------------------------------------------
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
  select * from fetch_chat_rooms(true) f where f.id = p_room_id;
$$;

comment on function fetch_chat_room(bigint) is
  '채팅방 하나의 요약. 나간 방도 열린다 — 나가기는 목록에서 치우는 일이다(0030). '
  '차단이 걸린 방은 여전히 열리지 않는다(0014).';

-- -----------------------------------------------------------------------------
-- 4. 손대지 않은 것 — fetch_post_chat_partners
--
-- 예약자·구매자 후보 목록(0008)이다. 판매자가 방을 나갔다고 해서 그 구매자가 거래 상대에서
-- 빠질 이유는 없다. 게다가 이 목록은 `posts_update` 정책이 허용하는 집합과 **정확히 같아야**
-- 하는데(0008), 여기만 좁히면 화면에는 없는 사람을 서버는 받아 주는 어긋남이 생긴다.
-- -----------------------------------------------------------------------------
