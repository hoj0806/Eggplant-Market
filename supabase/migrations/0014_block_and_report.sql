-- =============================================================================
-- 안전 — 차단 · 신고
--
-- 0001에 blocks·reports 테이블과 RLS가 이미 다 있다. 없는 것은 **차단이 실제로 작동하는
-- 자리**다. 차단 버튼만 붙이고 목록을 그대로 두면 차단한 사람의 글이 홈에 그대로 뜬다 —
-- 차단은 "안 보이게 하는 것"이지 "표시를 남기는 것"이 아니다.
--
-- 그래서 이 파일의 대부분은 새 기능이 아니라 **이미 있던 목록 RPC를 다시 정의하는 일**이다.
--   · search_posts     (0011)  홈·검색이 함께 쓴다
--   · fetch_chat_rooms (0008)  채팅 목록·채팅방 하나가 함께 쓴다
--   · open_chat_room   (0008)  차단한 상대에게는 방을 열어 주지 않는다
--   · messages_insert  (0001)  이미 열려 있던 방으로 밀어 넣는 길을 막는다
--
-- 신고는 저장만 하면 되지만(조회 정책이 없어 설계상 관리자 전용) 사유·중복·자기 신고를
-- 서버가 판단해야 한다. 0013이 reviews에 제약을 채운 것과 같은 이유다 — 화면 규칙으로 둘 수 없다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 차단 판단은 private 스키마에서
--
-- 차단은 **양방향**이다. 내가 차단한 사람도, 나를 차단한 사람도 서로 보이지 않아야 한다.
-- 그런데 blocks_select(0001)는 `auth.uid() = blocker_id` — **내가 건 차단만** 읽힌다.
-- RLS 정책이나 security invoker 함수 안에서 blocks를 조회해도 이 정책이 그대로 걸리므로
-- "나를 차단한 사람"은 어떤 방법으로도 보이지 않는다.
--
-- 그렇다고 blocks에 `auth.uid() = blocked_id` 정책을 더할 수는 없다. 그 순간
-- **누가 나를 차단했는지 목록으로 조회할 수 있게 된다.** 차단은 상대가 몰라야 의미가 있다.
--
-- 답은 security definer 함수를 두되 **클라이언트가 부를 수 없는 곳에 두는 것**이다.
-- PostgREST는 노출 스키마(public)의 함수만 라우팅하므로 private 스키마에 있으면
-- SQL 안에서만 쓰이고 `supabase.rpc()`로는 닿지 않는다.
--
-- 남는 노출은 하나다 — 나를 차단한 사람의 글이 목록에서 사라지므로 눈치챌 수는 있다.
-- 이것은 차단을 양방향으로 만드는 이상 어느 서비스에서도 피할 수 없는 값이고,
-- "목록으로 확인할 수 있는 것"과는 무게가 다르다.
-- -----------------------------------------------------------------------------
create schema if not exists private;

-- 목록에서 통째로 걸러낼 사람들. 배열로 한 번에 받아 와야 목록 RPC가 행마다 blocks를
-- 다시 뒤지지 않는다.
create or replace function private.blocked_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(counterpart), '{}')
    from (
      select b.blocked_id as counterpart from blocks b where b.blocker_id = auth.uid()
      union
      select b.blocker_id                from blocks b where b.blocked_id = auth.uid()
    ) s;
$$;

comment on function private.blocked_user_ids() is
  '나와 차단 관계에 있는 사용자 id 전부(내가 건 것 + 나를 건 것). 목록 RPC가 한 번 불러 배열로 거른다.';

-- 두 사람 사이만 보는 판정. 정책·행위 검사처럼 "이 상대와 되는가"만 물을 때 쓴다.
create or replace function private.is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b)
        or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

comment on function private.is_blocked(uuid, uuid) is
  '두 사용자 사이에 차단이 있는지(방향 무관). 차단은 양방향으로 막히므로 어느 쪽이 걸었는지는 묻지 않는다.';

-- 함수는 private에 있어도 호출은 로그인 사용자·게스트의 권한으로 일어난다
-- (search_posts·정책이 security invoker이므로). 스키마 사용 권한을 열어 준다 —
-- PostgREST가 라우팅하지 않으므로 rpc로는 여전히 닿지 않는다.
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.blocked_user_ids()      to anon, authenticated, service_role;
grant execute on function private.is_blocked(uuid, uuid)  to anon, authenticated, service_role;

-- 0001의 blocks 기본키는 (blocker_id, blocked_id)라 "나를 차단한 사람"을 찾는 두 번째 갈래가
-- 인덱스를 타지 못한다. 위 union의 아래쪽이 이 인덱스를 쓴다.
create index if not exists blocks_blocked_idx on blocks (blocked_id);

-- -----------------------------------------------------------------------------
-- 2. 목록에서 걸러내기 — search_posts
--
-- 0011의 본문을 그대로 두고 조건 한 줄과 파라미터 한 칸($10)만 더한다.
-- 시그니처가 같아 create or replace가 그대로 교체한다(0011이 옛 시그니처를 drop해야 했던
-- 것과 다른 경우다 — 인자 목록이 바뀌지 않았다).
--
-- 차단 목록은 함수 시작에 **한 번** 읽어 배열로 들고 간다. 조건을 행마다 exists로 걸면
-- 동네 글 수만큼 blocks를 뒤진다.
--
-- `<> all('{}')`는 참이라 차단이 없는 대부분의 사용자에게는 조건이 없는 것과 같다.
-- 게스트도 마찬가지다 — auth.uid()가 null이면 빈 배열이 온다.
-- -----------------------------------------------------------------------------
create or replace function search_posts(
  p_region_code    text,
  p_keyword        text    default null,
  p_category_id    bigint  default null,
  p_min_price      integer default null,
  p_max_price      integer default null,
  p_available_only boolean default false,
  p_sort           text    default 'latest',
  p_cursor_value   text    default null,
  p_cursor_id      bigint  default null,
  p_limit          integer default 20
)
returns table (
  id            bigint,
  title         text,
  price         integer,
  status        post_status,
  thumbnail_url text,
  dong_name     text,
  like_count    integer,
  view_count    integer,
  bumped_at     timestamptz
)
language plpgsql
stable
as $$
declare
  v_column    text;     -- 정렬 컬럼
  v_direction text;     -- asc | desc
  v_type      text;     -- 커서 문자열을 되돌릴 타입
  v_compare   text;     -- 커서보다 "뒤"를 뜻하는 부등호
  v_blocked   uuid[];   -- 목록에서 통째로 뺄 사람들
begin
  case coalesce(p_sort, 'latest')
    when 'latest' then
      v_column := 'p.bumped_at';  v_direction := 'desc'; v_type := 'timestamptz';
    when 'popular' then
      v_column := 'p.view_count'; v_direction := 'desc'; v_type := 'integer';
    when 'likes' then
      v_column := 'p.like_count'; v_direction := 'desc'; v_type := 'integer';
    when 'price_asc' then
      v_column := 'p.price';      v_direction := 'asc';  v_type := 'integer';
    when 'price_desc' then
      v_column := 'p.price';      v_direction := 'desc'; v_type := 'integer';
    else
      raise exception '알 수 없는 정렬 기준입니다: %', p_sort
        using errcode = 'invalid_parameter_value';
  end case;

  -- 내림차순이면 커서보다 작은 쪽이, 오름차순이면 큰 쪽이 다음 페이지다.
  v_compare := case when v_direction = 'desc' then '<' else '>' end;

  v_blocked := private.blocked_user_ids();

  -- format 안에서 %는 %%로 적어야 한다. ILIKE의 와일드카드가 여기에 걸린다.
  return query execute format(
    $q$
      select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
             p.like_count, p.view_count, p.bumped_at
        from posts p
       where p.region_code = $1
         -- 검색 기준은 제품 이름(title)과 게시물 내용(description) 두 곳이다.
         and (
           $2 is null or btrim($2) = ''
           or p.title       ilike '%%' || escape_like_pattern(btrim($2)) || '%%'
           or p.description ilike '%%' || escape_like_pattern(btrim($2)) || '%%'
         )
         -- 대분류를 고르면 그 아래 소분류 글이 전부 걸린다.
         and (
           $3 is null
           or p.category_id = $3
           or p.category_id in (select c.id from categories c where c.parent_id = $3)
         )
         and ($4 is null or p.price >= $4)
         and ($5 is null or p.price <= $5)
         -- "거래 가능만 보기" = 판매완료만 숨긴다. 예약중은 아직 거래가 틀어질 수 있어 남긴다.
         and (not coalesce($6, false) or p.status <> 'sold')
         -- 차단 관계에 있는 사람의 글은 목록에 오지 않는다.
         and p.seller_id <> all ($10)
         -- keyset 커서. 정렬값 하나로는 같은 값을 가진 글이 페이지 경계에서 겹치거나 사라진다.
         and (
           $7 is null
           or %1$s %2$s $7::%3$s
           or (%1$s = $7::%3$s and p.id < $8)
         )
       order by %1$s %4$s, p.id desc
       limit $9
    $q$,
    v_column, v_compare, v_type, v_direction
  )
  using
    p_region_code,
    p_keyword,
    p_category_id,
    p_min_price,
    p_max_price,
    p_available_only,
    p_cursor_value,
    -- 커서 id가 없으면 tie-breaker를 통과시키지 않는다(첫 페이지에는 $7도 null이라 무의미하다).
    coalesce(p_cursor_id, 0),
    -- 클라이언트가 보내는 값을 그대로 믿지 않는다.
    least(greatest(coalesce(p_limit, 20), 1), 50),
    v_blocked;
end;
$$;

comment on function search_posts is
  '내 동네(region_code) 안에서 검색어·카테고리·가격구간·거래가능 필터를 모두 중첩 적용한 목록. '
  'p_sort로 정렬(latest·popular·likes·price_asc·price_desc)을 고르고, (정렬값, id) keyset 페이징한다. '
  '차단 관계에 있는 사용자의 글은 빠진다.';

-- -----------------------------------------------------------------------------
-- 3. 목록에서 걸러내기 — fetch_chat_rooms
--
-- 방 목록에서 상대가 빠지면 fetch_chat_room(0008)도 함께 빈다 — 그쪽이 이 함수를
-- 그대로 걸러 쓰기 때문이다. 의도한 결과다. 차단한 상대의 방은 목록에서도, 주소를 직접
-- 쳐서 들어가도 열리지 않는다("채팅방을 찾을 수 없습니다").
--
-- 방과 메시지 자체는 지우지 않는다. 차단을 풀면 대화가 그대로 돌아온다.
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
     -- 차단한(또는 나를 차단한) 상대의 방은 목록에 오지 않는다.
     and partner.id <> all (private.blocked_user_ids())
   order by coalesce(r.last_message_at, r.created_at) desc, r.id desc;
$$;

comment on function fetch_chat_rooms is
  '내가 참여한 채팅방 목록. 상대 프로필·게시물 요약·마지막 메시지·안 읽은 수를 한 번에 돌려준다. '
  '차단 관계에 있는 상대의 방은 빠진다.';

-- -----------------------------------------------------------------------------
-- 4. 차단한 상대와는 새 대화를 시작할 수 없다
--
-- 목록에서 지우는 것만으로는 부족하다. 게시물 상세는 여전히 열리므로("차단한 사람의 글도
-- 주소를 알면 볼 수 있다") 거기서 채팅 버튼을 누르는 길이 남는다.
-- 화면에서도 감추지만 규칙의 주인은 서버다(0008 open_chat_room의 자기 게시물 검사와 같다).
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

  -- 어느 쪽이 걸었는지는 말해 주지 않는다. "상대가 나를 차단했다"를 알려 주는 문구가 되면
  -- 차단이 상대에게 드러난다.
  if private.is_blocked(auth.uid(), v_seller) then
    raise exception '차단한 사용자와는 대화할 수 없습니다.' using errcode = 'insufficient_privilege';
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
  '게시물에 대한 나(구매자)와 판매자의 채팅방을 열어 id를 돌려준다. 이미 있으면 그 방을 준다. '
  '자기 게시물과 차단 관계인 상대에게는 열 수 없다.';

-- -----------------------------------------------------------------------------
-- 5. 이미 열려 있던 방으로 밀어 넣는 길
--
-- 차단은 대개 **대화를 나눈 뒤에** 누른다. 즉 방은 이미 있다. 목록에서 감추고 새 방을 막아도
-- 상대는 자기 화면에 그대로 남아 있는 그 방에 계속 쓸 수 있다 — 차단한 사람에게는 보이지
-- 않지만 차단을 풀면 그동안 쌓인 말이 한꺼번에 나타난다.
--
-- 0001의 messages_insert에 조건 하나를 얹는다. 정책이 blocks를 직접 조회하면 blocks_select에
-- 걸려 "내가 건 차단"만 보이므로, 1번의 security definer 판정을 부른다.
-- -----------------------------------------------------------------------------
drop policy if exists messages_insert on messages;
create policy messages_insert on messages
  for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
        from chat_rooms r
       where r.id = messages.room_id
         and auth.uid() in (r.buyer_id, r.seller_id)
         and not private.is_blocked(
               auth.uid(),
               case when r.buyer_id = auth.uid() then r.seller_id else r.buyer_id end
             )
    )
  );

-- 읽음 표시(messages_update)는 건드리지 않는다. 차단 전에 받은 메시지를 읽음으로 바꾸는 일까지
-- 막으면 안 읽은 수가 영영 줄지 않는다.

-- =============================================================================
-- 신고
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 6. 신고에 형태를 준다
--
-- 0001의 reports는 reason·target_id가 자유 text다. 신고는 사람이 읽고 처리하는 기록이라
-- 사유가 제각각이면 분류가 안 되고, target_id가 아무 문자열이면 어떤 글·누구를 가리키는지
-- 알 수 없는 행이 쌓인다.
--
-- 사유는 목록으로 묶되 **대상 종류별로 나누지는 않는다.** 게시물 사유를 사용자 신고에 넣어도
-- 위험한 일은 일어나지 않고(신고는 사람이 읽는다), 그 구분은 화면이 고르는 문제다.
-- 여기서 막는 것은 "분류할 수 없는 값"이다.
--
-- 자기 자신 신고는 사용자 신고만 제약으로 막을 수 있다. 게시물은 seller_id를 봐야 알 수 있어
-- 아래 create_report가 판단한다(0013 reviews_insert가 posts를 봐야 했던 것과 같은 자리).
-- -----------------------------------------------------------------------------
alter table reports drop constraint if exists reports_reason_allowed;
alter table reports add constraint reports_reason_allowed
  check (reason in ('fraud', 'prohibited', 'spam', 'abuse', 'inappropriate', 'other'));

alter table reports drop constraint if exists reports_detail_bounded;
alter table reports add constraint reports_detail_bounded
  check (detail is null or char_length(detail) <= 500);

-- 게시물이면 숫자, 사용자면 uuid. 형태가 맞지 않는 행은 처리할 수 없는 행이다.
alter table reports drop constraint if exists reports_target_id_shaped;
alter table reports add constraint reports_target_id_shaped
  check (
    (target_type = 'post' and target_id ~ '^[0-9]+$')
    or
    (target_type = 'user' and target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  );

alter table reports drop constraint if exists reports_no_self_user;
alter table reports add constraint reports_no_self_user
  check (not (target_type = 'user' and target_id = reporter_id::text));

-- 같은 대상을 두 번 신고할 수 없다. 한 사람이 같은 글을 여러 번 신고해도 처리 우선순위가
-- 올라가지는 않는다 — 쌓이는 것은 잡음뿐이다.
create unique index if not exists reports_reporter_target_idx
  on reports (reporter_id, target_type, target_id);

comment on column reports.reason is
  '신고 사유 코드. fraud·prohibited·spam·abuse·inappropriate·other 여섯 중 하나(reports_reason_allowed).';

-- -----------------------------------------------------------------------------
-- 7. 신고하기
--
-- reports_insert(0001)가 `auth.uid() = reporter_id`를 이미 보므로 클라이언트가 테이블에
-- 직접 넣어도 되기는 한다. 그런데도 RPC를 두는 이유는 **거절 이유를 말해 주기 위해서**다.
-- 신고 화면은 조회 정책이 없어(설계상 관리자 전용) 결과를 다시 읽어 확인할 수 없다.
-- 넣는 순간의 응답이 사용자가 받는 유일한 답이라, 그 답이 23505/23514가 아니라 한국어여야 한다.
--
-- **reports는 select 정책이 없다.** 이 한 줄이 함수 모양을 두 군데 정한다.
--   ① `returns bigint` + `insert ... returning`을 쓸 수 없다. RETURNING은 넣은 행을
--      다시 읽는 일이라 select 정책을 타고, 정책이 없으면 insert 전체가 42501로 되돌아온다.
--      돌려줄 id도 신고자가 두 번 다시 쓸 수 없는 값이라 아쉬울 것이 없다 → returns void.
--   ② 중복도 `exists (select 1 from reports ...)`로 미리 볼 수 없다. 조회가 언제나 0건이라
--      검사가 있으나 마나다. 6번의 unique 인덱스가 실제로 막고, 여기서는 그 23505를
--      받아 한국어로 바꾼다. **막는 것은 인덱스, 말해 주는 것은 함수**다.
--
-- security definer가 아니다. 위 정책이 그대로 걸려야 이 함수 밖의 경로도 같은 규칙을 탄다
-- (0013 create_review와 같은 판단).
-- -----------------------------------------------------------------------------
-- 반환 타입은 create or replace로 바꿀 수 없다. 이 파일을 다시 돌릴 때를 위해 먼저 지운다.
drop function if exists create_report(text, text, text, text);

create or replace function create_report(
  p_target_type text,
  p_target_id   text,
  p_reason      text,
  p_detail      text default null
)
returns void
language plpgsql
as $$
declare
  v_user   uuid := auth.uid();
  v_target report_target;
  v_seller uuid;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = 'insufficient_privilege';
  end if;

  if p_target_type not in ('post', 'user') then
    raise exception '알 수 없는 신고 대상입니다: %', p_target_type
      using errcode = 'invalid_parameter_value';
  end if;
  v_target := p_target_type::report_target;

  if p_reason not in ('fraud', 'prohibited', 'spam', 'abuse', 'inappropriate', 'other') then
    raise exception '알 수 없는 신고 사유입니다: %', p_reason
      using errcode = 'invalid_parameter_value';
  end if;

  -- 없는 것을 신고할 수는 없다. 6번의 형태 제약이 걸러 주지 못하는 "형태는 맞지만 없는 대상"이다.
  if v_target = 'post' then
    select p.seller_id into v_seller from posts p where p.id::text = p_target_id;

    if v_seller is null then
      raise exception '게시물을 찾을 수 없습니다.' using errcode = 'no_data_found';
    end if;

    if v_seller = v_user then
      raise exception '내 게시물은 신고할 수 없습니다.' using errcode = 'check_violation';
    end if;
  else
    if p_target_id = v_user::text then
      raise exception '자기 자신은 신고할 수 없습니다.' using errcode = 'check_violation';
    end if;

    if not exists (select 1 from profiles f where f.id::text = p_target_id) then
      raise exception '사용자를 찾을 수 없습니다.' using errcode = 'no_data_found';
    end if;
  end if;

  insert into reports (reporter_id, target_type, target_id, reason, detail)
  values (
    v_user,
    v_target,
    p_target_id,
    p_reason,
    -- 빈 문자열은 "안 썼다"와 같다. null로 눕혀 관리자 화면이 한 가지만 보게 한다(0013과 같다).
    nullif(btrim(coalesce(p_detail, '')), '')
  );

-- 위 raise들은 저마다 다른 errcode를 쓰므로 이 핸들러에 잡히지 않는다.
exception
  when unique_violation then
    raise exception '이미 신고한 대상입니다.' using errcode = 'unique_violation';
end;
$$;

comment on function create_report(text, text, text, text) is
  '게시물·사용자 신고. 사유·대상 존재·자기 신고·중복을 서버가 판단하고 거절 이유를 한국어로 돌려준다. '
  '신고자는 자기 신고도 다시 조회할 수 없다(reports에 select 정책이 없다).';

-- -----------------------------------------------------------------------------
-- 8. 내가 차단한 사람들
--
-- blocks에는 id와 시각뿐이라 목록 화면이 닉네임·사진을 profiles에서 다시 이어 붙여야 한다.
-- PostgREST 임베드로도 되지만 0009·0012가 목록마다 RPC 하나를 두기로 했으므로 결을 맞춘다.
--
-- 페이징하지 않는다. 차단 목록은 수십 건을 넘기 어렵고, 넘겨도 관리 화면이라 한 번에 보는 편이
-- 낫다. 그래도 상한은 둔다.
--
-- security definer가 아니다. blocks_select가 `내가 건 것`만 보여 주는 그 범위가 정확히
-- 이 화면이 보여야 할 범위다 — 나를 차단한 사람은 여기 오지 않는다.
-- -----------------------------------------------------------------------------
create or replace function fetch_blocked_users(p_limit integer default 100)
returns table (
  id         uuid,
  nickname   text,
  avatar_url text,
  blocked_at timestamptz
)
language sql
stable
as $$
  select f.id, f.nickname, f.avatar_url, b.created_at
    from blocks b
    join profiles f on f.id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc
   limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

comment on function fetch_blocked_users(integer) is
  '내가 차단한 사용자 목록. 나를 차단한 사람은 포함하지 않는다(blocks_select 범위 그대로).';
