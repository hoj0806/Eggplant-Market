-- =============================================================================
-- 0024_radius_search.sql — 목록의 기준을 하나 더 연다: 법정동 일치 ∥ 반경
--
-- 0001이 `nearby_posts`를, `profiles`가 `search_radius_m`을, 0005가 `posts.location`을
-- 깔아 뒀지만 **셋 다 한 번도 불리지 않았다.** 목록의 기준은 줄곧 법정동 코드 일치였다.
--
-- 여기서 반경을 연다. 다만 **법정동을 버리지 않는다.** 둘을 병행한다 —
-- "우리 동네"는 사람들이 이름으로 아는 단위라 그 자체로 뜻이 있고, 반경은 동 경계에
-- 걸쳐 사는 사람에게 필요한 기준이다. 하나로 합치면 한쪽 사용자가 쓰던 결과가 조용히 바뀐다.
--
-- -----------------------------------------------------------------------------
-- 왜 `nearby_posts`를 살리지 않고 지우는가
--
-- 그 함수는 0001이 아무 화면도 없을 때 적어 둔 것이라, 그동안 목록에 쌓인 규칙을 하나도 모른다.
--
--   · 차단 사용자 제외 (0014) — 없다. 반경으로 보는 순간 차단이 비껴간다.
--   · 검색어·카테고리·가격·거래가능 필터 (0007) — 카테고리 하나뿐이다.
--   · (정렬값, id) keyset (0011) — 커서가 bumped_at 하나라 같은 시각 글이 겹치거나 사라진다.
--   · 반환 모양 — `setof posts`라 목록 카드가 쓰는 모양(`thumbnail_url`·`like_count`…)이 아니다.
--
-- 즉 "이미 있는 것을 잇기만 하면 된다"가 아니었다. 채워 넣으면 `search_posts`와 같아지고,
-- 같아진 둘을 나란히 두면 **목록이라면 모두 적용돼야 하는 규칙**을 넣을 때마다 두 곳을 고쳐야 한다.
-- 0014가 실제로 그 값을 치렀다(목록 RPC·채팅방 목록·새 대화·메시지 넷을 한꺼번에 고쳤다).
-- `postApi.fetchNeighborhoodPosts`가 홈 전용 질의를 따로 두지 않고 `search_posts`를 그대로
-- 부르는 것도 같은 이유다. 그래서 **기준을 함수로 가르지 않고 인자로 가른다.**
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 낡은 반경 RPC 정리
--
-- 한 번도 불린 적이 없어 지워도 깨지는 것이 없다. 남겨 두면 "반경 검색은 저기 있다"고
-- 읽히는데 정작 차단이 빠져 있어, 다음에 집어 드는 사람이 구멍을 그대로 물려받는다.
-- -----------------------------------------------------------------------------
drop function if exists nearby_posts(
  double precision, double precision, integer, bigint, timestamptz, integer
);

-- -----------------------------------------------------------------------------
-- 2. search_posts — 기준을 인자로 받는다
--
-- `create or replace`로는 안 된다. 인자가 늘고 반환 모양이 바뀌어서, 그대로 두면
-- **옛 시그니처가 남은 채 새 함수가 하나 더 생긴다.** PostgREST는 그때 어느 쪽을 부를지
-- 정하지 못해 PGRST203으로 거절한다. 먼저 지운다.
--
-- 인자 순서도 바꿨다(기준 넷이 맨 앞). PostgREST는 이름으로 부르므로 클라이언트는 영향받지 않는다.
-- -----------------------------------------------------------------------------
drop function if exists search_posts(
  text, text, bigint, integer, integer, boolean, text, text, bigint, integer
);

create function search_posts(
  -- 기준 ①: 법정동 코드가 같은 글. 지금까지의 유일한 기준이었다.
  p_region_code    text    default null,
  -- 기준 ②: 이 좌표에서 p_radius_m 안에 있는 글. 셋이 함께 와야 뜻이 선다.
  p_lat            double precision default null,
  p_lng            double precision default null,
  p_radius_m       integer default null,
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
  bumped_at     timestamptz,
  -- 반경 기준일 때만 채워진다. 법정동 기준에서는 null이다 — 잴 중심이 없다.
  distance_m    double precision
)
language plpgsql
stable
as $$
declare
  v_column    text;        -- 정렬 컬럼(또는 식)
  v_direction text;        -- asc | desc
  v_type      text;        -- 커서 문자열을 되돌릴 타입
  v_compare   text;        -- 커서보다 "뒤"를 뜻하는 부등호
  v_blocked   uuid[];      -- 목록에서 통째로 뺄 사람들
  v_center    geography;   -- 반경의 중심. 법정동 기준이면 null이다
  v_radius    integer;     -- 반경(미터)
begin
  -- ---------------------------------------------------------------------------
  -- 기준을 정한다
  --
  -- 좌표는 둘 다 있어야 한 점이 된다. 하나만 오면 "반경 기준인데 중심이 없는" 상태라
  -- 조용히 법정동으로 되돌리지 않고 여기서 멈춘다 — 되돌리면 사용자는 반경으로 보고 있다고
  -- 믿는 채 다른 결과를 읽는다.
  --
  -- 반경은 클라이언트가 보낸 값을 믿지 않는다. 0은 언제나 0건이고, 너무 크면 전국이 걸려
  -- 동네 장터라는 전제가 무너진다. p_limit을 서버가 한 번 더 조이는 것과 같은 자리다.
  -- ---------------------------------------------------------------------------
  if (p_lat is null) <> (p_lng is null) then
    raise exception '좌표는 위도와 경도가 함께 있어야 합니다.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_lat is not null then
    v_center := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
    v_radius := least(greatest(coalesce(p_radius_m, 2000), 100), 20000);
  end if;

  if p_region_code is null and v_center is null then
    raise exception '검색 기준이 없습니다. 법정동 코드나 좌표 중 하나는 있어야 합니다.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- ---------------------------------------------------------------------------
  -- 정렬
  --
  -- 'distance'만 다른 넷과 성격이 다르다. 나머지는 posts의 칸을 그대로 읽지만 거리는
  -- **중심이 있어야 계산되는 값**이라, 법정동 기준으로 보면서 거리순을 고르면 정렬 키가
  -- 전부 null이 된다. 그러면 순서는 사실상 id뿐인데 화면에는 "가까운 순"이라고 적힌다.
  -- 거짓말이 되기 전에 거절한다.
  --
  -- 거리는 동 단위로 뭉친다 — `posts.location`이 판매자의 정확한 위치가 아니라
  -- **동네 대표 좌표**이기 때문이다(0005). 같은 동 글은 거리가 전부 같다.
  -- 즉 이 정렬의 실질은 "가까운 동네부터"다. 그것이 이 데이터로 말할 수 있는 전부다.
  -- ---------------------------------------------------------------------------
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
    when 'distance' then
      if v_center is null then
        raise exception '거리순으로 보려면 기준 좌표가 필요합니다.'
          using errcode = 'invalid_parameter_value';
      end if;
      -- $11은 아래 using의 v_center다. 식을 그대로 정렬 키로 쓴다.
      v_column := 'st_distance(p.location, $11)';
      v_direction := 'asc';
      v_type := 'double precision';
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
             p.like_count, p.view_count, p.bumped_at,
             -- 중심이 없으면(법정동 기준) null이 나온다. 따로 case로 가를 것이 없다.
             st_distance(p.location, $11) as distance_m
        from posts p
       -- 기준 둘은 서로 배타적이지 않다. 안 쓰는 쪽은 null이라 통과할 뿐이다.
       -- 그래서 둘 다 보내면 교집합이 된다 — 지금 화면은 그렇게 부르지 않지만
       -- "이 동네 안에서 500m" 같은 것을 나중에 열 자리는 여기다.
       where ($1 is null or p.region_code = $1)
         -- location이 null인 글(0005 이전)은 반경 기준에서 빠진다. st_dwithin이 null이라
         -- where가 통과시키지 않는다. 법정동 기준에는 영향이 없다.
         and ($11 is null or st_dwithin(p.location, $11, $12))
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
         -- 거리순에서는 이 tie-breaker가 특히 자주 걸린다 — 같은 동 글은 거리가 전부 같다.
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
    v_blocked,
    v_center,
    v_radius;
end;
$$;

comment on function search_posts is
  '게시물 목록. 기준은 법정동 코드(p_region_code)나 좌표+반경(p_lat·p_lng·p_radius_m) 중 하나이며 '
  '둘 다 주면 교집합이다. 검색어·카테고리·가격구간·거래가능 필터를 중첩 적용하고, '
  'p_sort로 정렬(latest·popular·likes·price_asc·price_desc·distance)한 뒤 (정렬값, id) keyset 페이징한다. '
  'distance는 좌표가 있어야 쓸 수 있다. 차단 관계에 있는 사용자의 글은 빠진다.';

-- -----------------------------------------------------------------------------
-- 3. search_radius_m — 스키마는 그대로 두고 뜻만 적어 둔다
--
-- 0001이 만들어 둔 칸을 이제 실제로 읽는다. 값을 강제하는 제약을 붙이지 않은 이유는
-- **서버가 어차피 위에서 조이기 때문**이다(100~20000). 제약을 두면 같은 규칙이 두 곳에
-- 생기고, 범위를 넓힐 때 마이그레이션이 한 번 더 필요해진다.
--
-- 0023이 이 칸을 잠그지 않은 것도 그대로다 — 사용자가 자기 뜻으로 정하는 값이고
-- 남에게 보여도 거짓말이 되지 않는다.
-- -----------------------------------------------------------------------------
comment on column profiles.search_radius_m is
  '반경 기준으로 볼 때 쓰는 검색 반경(미터). search_posts가 100~20000으로 조인다. 법정동 기준에서는 쓰이지 않는다.';
