-- =============================================================================
-- 마이페이지 — 내가 남긴 흔적을 읽는 자리
--
-- 테이블을 새로 만들지 않는다. 필요한 것은 이미 다 있다.
--   likes(0001) · recently_viewed(0001) · posts.buyer_id/sold_at(0008)
-- 없는 것은 **읽는 길**뿐이고, recently_viewed는 그 위에 **쓰는 길**도 없다.
--
-- 네 목록의 정렬 기준이 저마다 다른 테이블에 있다는 것이 이 파일의 전부다.
--   관심목록   likes.created_at          찜한 순서
--   최근 본 글 recently_viewed.viewed_at 본 순서
--   구매내역   posts.sold_at             거래완료 순서
--   판매관리   posts.bumped_at           끌올 순서
--
-- PostgREST 임베드로는 "조인 상대의 컬럼으로 keyset 페이징"이 나오지 않는다.
-- 0007 search_posts · 0008 fetch_chat_rooms가 같은 이유로 RPC를 쓰고 있어 결을 맞춘다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 반환 모양을 넷이 공유한다
--
-- 앞의 아홉 컬럼은 0007 search_posts와 글자 그대로 같다(= 목록 카드가 읽는 PostSummary).
-- 클라이언트가 행 변환 코드와 카드 컴포넌트를 한 벌만 들고 있으면 된다.
--
-- 마지막 sort_at 하나가 목록마다 달라지는 자리다. 정렬 기준이자 커서의 앞 절반이고,
-- 화면에서는 "3일 전 찜" · "7월 30일 구매" 같은 문구의 재료가 된다.
--
-- security definer를 쓰지 않는다. 0007·0008과 같은 이유로 호출자 권한이어야
-- recently_viewed_select(본인 행만)가 그대로 걸린다 — 남의 발자취가 새지 않는다.
--
-- keyset 조건과 limit 방어도 0007의 형태를 그대로 가져온다.
-- (sort_at 하나로는 같은 시각 행이 페이지 경계에서 겹치거나 사라진다)
-- -----------------------------------------------------------------------------

-- 관심목록 -------------------------------------------------------------------
-- likes_select는 using(true)라 남의 찜도 읽힌다. 그래서 여기서 auth.uid()로 직접 좁힌다.
create or replace function fetch_liked_posts(
  p_cursor_at timestamptz default null,
  p_cursor_id bigint      default null,
  p_limit     integer     default 20
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
  bumped_at     timestamptz,
  sort_at       timestamptz
)
language sql
stable
as $$
  select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
         p.like_count, p.view_count, p.bumped_at,
         l.created_at
    from likes l
    join posts p on p.id = l.post_id
   where l.user_id = auth.uid()
     and (
       p_cursor_at is null
       or l.created_at < p_cursor_at
       or (l.created_at = p_cursor_at and p.id < coalesce(p_cursor_id, 0))
     )
   order by l.created_at desc, p.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function fetch_liked_posts is
  '내가 찜한 게시물 목록. 찜한 시각(likes.created_at) 내림차순, (sort_at, id) keyset 페이징.';

-- 최근 본 글 -----------------------------------------------------------------
create or replace function fetch_recently_viewed_posts(
  p_cursor_at timestamptz default null,
  p_cursor_id bigint      default null,
  p_limit     integer     default 20
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
  bumped_at     timestamptz,
  sort_at       timestamptz
)
language sql
stable
as $$
  select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
         p.like_count, p.view_count, p.bumped_at,
         v.viewed_at
    from recently_viewed v
    join posts p on p.id = v.post_id
   where v.user_id = auth.uid()
     and (
       p_cursor_at is null
       or v.viewed_at < p_cursor_at
       or (v.viewed_at = p_cursor_at and p.id < coalesce(p_cursor_id, 0))
     )
   order by v.viewed_at desc, p.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function fetch_recently_viewed_posts is
  '내가 최근 본 게시물 목록. viewed_at 내림차순. 삭제된 게시물은 FK cascade로 이미 빠져 있다.';

-- 구매내역 -------------------------------------------------------------------
-- 거래완료된 것만 넣는다. 0008이 sold_at을 두며 "거래후기·구매내역의 기준"이라고 적어 둔 자리다.
-- 예약중은 아직 거래가 아니다 — 틀어지면 판매중으로 되돌아가고 buyer_id가 지워진다.
--
-- coalesce가 붙은 이유: sold_at은 0008의 전이 트리거가 채우므로, 그 전에 이미
-- sold로 넘어가 있던 행에는 비어 있을 수 있다. 그런 행이 정렬에서 맨 뒤로 사라지지 않게 한다.
create or replace function fetch_purchased_posts(
  p_cursor_at timestamptz default null,
  p_cursor_id bigint      default null,
  p_limit     integer     default 20
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
  bumped_at     timestamptz,
  sort_at       timestamptz
)
language sql
stable
as $$
  select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
         p.like_count, p.view_count, p.bumped_at,
         coalesce(p.sold_at, p.updated_at)
    from posts p
   where p.buyer_id = auth.uid()
     and p.status = 'sold'
     and (
       p_cursor_at is null
       or coalesce(p.sold_at, p.updated_at) < p_cursor_at
       or (coalesce(p.sold_at, p.updated_at) = p_cursor_at and p.id < coalesce(p_cursor_id, 0))
     )
   order by coalesce(p.sold_at, p.updated_at) desc, p.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function fetch_purchased_posts is
  '내가 구매한(거래완료된) 게시물 목록. 기준은 posts.buyer_id = 나 and status = sold.';

-- 판매관리 -------------------------------------------------------------------
-- 상태 필터가 하나 더 붙는다. 규칙은 0007과 같다 — 주지 않으면 거는 조건이 없다(= 전체).
create or replace function fetch_selling_posts(
  p_status    post_status default null,
  p_cursor_at timestamptz default null,
  p_cursor_id bigint      default null,
  p_limit     integer     default 20
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
  bumped_at     timestamptz,
  sort_at       timestamptz
)
language sql
stable
as $$
  select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
         p.like_count, p.view_count, p.bumped_at,
         p.bumped_at
    from posts p
   where p.seller_id = auth.uid()
     and (p_status is null or p.status = p_status)
     and (
       p_cursor_at is null
       or p.bumped_at < p_cursor_at
       or (p.bumped_at = p_cursor_at and p.id < coalesce(p_cursor_id, 0))
     )
   order by p.bumped_at desc, p.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function fetch_selling_posts is
  '내가 올린 게시물 목록(판매관리). p_status로 판매중·예약중·거래완료를 걸러 볼 수 있다.';

-- -----------------------------------------------------------------------------
-- 최근 본 글 기록
--
-- 클라이언트에서 upsert 한 번으로도 되지만 RPC로 감싼다. 이유는 세 가지다.
--   ① 본인 글 제외를 서버가 판단해야 한다 (increment_view_count와 같은 자리)
--   ② 오래된 기록을 잘라 내는 일까지 한 번의 왕복으로 끝난다
--   ③ 클라이언트가 user_id를 실어 보내지 않아도 된다
--
-- security definer가 아니다. recently_viewed_write(0001)가 본인 행만 허용하므로
-- 호출자 권한 그대로 통과하고, 그 정책이 곧 이 함수의 안전선이다.
--
-- 본인 글을 빼는 것은 조회수와 같은 판단이다 — 내 글은 판매관리에 이미 다 있고,
-- 글을 올린 사람이 자기 글을 확인할 때마다 최근 목록이 자기 글로 덮이면 쓸모가 없어진다.
-- -----------------------------------------------------------------------------
create or replace function record_recently_viewed(p_post_id bigint)
returns void
language plpgsql
as $$
declare
  -- 이만큼만 남긴다. 목록이 무한히 자라면 조회도 느려지고 사용자에게도 의미가 없다.
  c_keep constant integer := 100;
  v_user   uuid := auth.uid();
  v_seller uuid;
begin
  -- 비로그인은 남길 곳이 없다. 오류가 아니라 그냥 하지 않는 것이다.
  if v_user is null then
    return;
  end if;

  select seller_id into v_seller from posts where id = p_post_id;

  if v_seller is null or v_seller = v_user then
    return;
  end if;

  insert into recently_viewed (user_id, post_id, viewed_at)
  values (v_user, p_post_id, now())
  on conflict (user_id, post_id) do update set viewed_at = now();

  delete from recently_viewed rv
   where rv.user_id = v_user
     and rv.post_id not in (
       select keep.post_id
         from recently_viewed keep
        where keep.user_id = v_user
        order by keep.viewed_at desc, keep.post_id desc
        limit c_keep
     );
end;
$$;

comment on function record_recently_viewed(bigint) is
  '게시물 상세 진입 시 최근 본 목록에 남긴다. 본인 글·비로그인은 남기지 않으며 최근 100건만 유지한다.';

-- -----------------------------------------------------------------------------
-- 인덱스
--
-- likes는 0001에 (user_id, post_id) 기본키와 post_id 인덱스만 있다. 관심목록의 동선은
-- "내 것을 찜한 순서로"라 created_at이 정렬 키인데 그 조합을 덮는 인덱스가 없다.
-- recently_viewed는 0001의 (user_id, viewed_at desc)가 이미 있어 tie-breaker만 더한다.
-- 판매관리·구매내역은 0008의 posts_buyer_idx와 0001의 seller FK 인덱스에 정렬 키를 얹는다.
-- -----------------------------------------------------------------------------
create index if not exists likes_user_keyset_idx
  on likes (user_id, created_at desc, post_id desc);

create index if not exists recently_viewed_keyset_idx
  on recently_viewed (user_id, viewed_at desc, post_id desc);

create index if not exists posts_seller_keyset_idx
  on posts (seller_id, bumped_at desc, id desc);

create index if not exists posts_buyer_sold_idx
  on posts (buyer_id, sold_at desc, id desc)
  where status = 'sold';
