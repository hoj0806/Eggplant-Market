-- =============================================================================
-- 다른 사용자 프로필 — 거래 상대를 판단하는 자리
--
-- 새로 만드는 테이블도, 새로 여는 권한도 없다. profiles·posts·reviews의 select 정책은
-- 0001부터 셋 다 `using (true)`라 이미 공개다. 없는 것은 **한 번에 읽는 길**뿐이다.
--
-- 마이페이지(0009)와 겹쳐 보이지만 기준이 정반대다.
--   0009  누구의 것인지 **묻지 않는다** — auth.uid()로 서버가 정한다
--   0012  누구의 것인지 **받는다**   — 남의 프로필을 보는 화면이므로
-- 그래서 함수를 나눈다. 0009 쪽에 p_user_id를 뚫으면 "내 것만"이라는 보장이 사라진다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 프로필 머리말
--
-- 닉네임·사진·매너온도·동네에 숫자 셋을 얹는다. 셋 다 목록을 열지 않고도 보이는 값이라
-- 여기서 세어 온다 — 화면이 판매목록·후기목록을 각각 불러 length를 세면 첫 페이지(20건)까지만
-- 세게 되어 "판매중 20"에서 멈춘다.
--
-- 동네는 dong_name만 준다. 좌표(location_lat/lng)는 남의 집을 찍는 값이라 내려보내지 않는다.
-- 온보딩 전 사용자도 그대로 돌려준다 — 판단은 화면이 한다(빈 프로필은 글도 후기도 없다).
--
-- security definer가 아니다. 세 테이블의 select 정책이 공개라 호출자 권한으로 그대로 읽힌다.
-- -----------------------------------------------------------------------------
create or replace function fetch_user_profile(p_user_id uuid)
returns table (
  id            uuid,
  nickname      text,
  avatar_url    text,
  manner_temp   numeric,
  dong_name     text,
  created_at    timestamptz,
  selling_count integer,
  sold_count    integer,
  review_count  integer
)
language sql
stable
as $$
  select p.id, p.nickname, p.avatar_url, p.manner_temp, p.dong_name, p.created_at,
         (select count(*)::integer from posts s
           where s.seller_id = p.id and s.status <> 'sold'),
         (select count(*)::integer from posts s
           where s.seller_id = p.id and s.status = 'sold'),
         (select count(*)::integer from reviews r
           where r.reviewee_id = p.id)
    from profiles p
   where p.id = p_user_id;
$$;

comment on function fetch_user_profile(uuid) is
  '다른 사용자의 공개 프로필. 닉네임·사진·매너온도·동네와 판매중·거래완료·받은 후기 개수를 한 번에 준다. 좌표는 주지 않는다.';

-- -----------------------------------------------------------------------------
-- 2. 그 사람이 팔고 있는 물건
--
-- 반환 모양은 0009의 네 목록과 글자 그대로 같다. 클라이언트가 이미 들고 있는 행 변환과
-- 카드 컴포넌트를 그대로 쓰기 위해서다. sort_at은 여기서도 bumped_at이다(판매관리와 같다).
--
-- 거래완료된 글은 뺀다. 이 목록은 "지금 이 사람에게서 살 수 있는 것"이고,
-- 지난 거래가 몇 건인지는 1번의 sold_count가 이미 숫자로 말한다.
--
-- 인덱스는 0009의 posts_seller_keyset_idx(seller_id, bumped_at desc, id desc)를 그대로 탄다.
-- -----------------------------------------------------------------------------
create or replace function fetch_user_posts(
  p_user_id   uuid,
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
   where p.seller_id = p_user_id
     and p.status <> 'sold'
     and (
       p_cursor_at is null
       or p.bumped_at < p_cursor_at
       or (p.bumped_at = p_cursor_at and p.id < coalesce(p_cursor_id, 0))
     )
   order by p.bumped_at desc, p.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function fetch_user_posts(uuid, timestamptz, bigint, integer) is
  '다른 사용자가 판매중·예약중인 게시물 목록. 반환 모양은 0009의 마이페이지 목록과 같고 (bumped_at, id) keyset 페이징한다.';
