-- =============================================================================
-- 0025_region_counts.sql — 지도에 찍을 동 단위 집계
--
-- `backlog.md` §5-1의 나머지 절반. 0024가 "반경 안의 글 목록"을 열었고, 여기서는
-- **"반경 안에 어느 동네가 몇 건 있는가"**를 연다. 지도는 목록이 아니라 이쪽을 그린다.
--
-- -----------------------------------------------------------------------------
-- 왜 목록이 아니라 개수인가
--
-- 글마다 핀을 찍을 수 없다. `posts.location`이 판매자 동네의 대표 좌표라(0005)
-- **같은 동 글은 좌표가 사실상 한 점**이다 — 0024에서 27건의 거리가 전부 같았던 그 이유다.
-- 핀을 그대로 찍으면 한 자리에 27개가 겹쳐 쌓이고, 보기 좋으라고 흩뿌리면 **없는 위치를
-- 지어내는** 것이 된다. 그래서 처음부터 겹치는 것을 하나로 세어 내려보낸다.
--
-- -----------------------------------------------------------------------------
-- 0024에서 한 말과 어긋나지 않는가 — 필터를 두 번 적지 않는다
--
-- 0024는 `nearby_posts`를 지우면서 "같은 결과를 내는 함수를 둘 두면 목록 규칙을 넣을 때마다
-- 두 곳을 고쳐야 한다"고 적었다. 여기서 필터(검색어·카테고리·가격·거래가능·**차단**)를 다시
-- 적으면 그 말을 하루 만에 뒤집는 셈이다. 특히 차단이 위험하다 — 목록에서는 빠지는데
-- 지도에서는 세어지면, 눌러 들어간 동네의 개수와 실제 목록이 어긋난다.
--
-- 그래서 **WHERE를 함수 하나로 빼고 둘이 함께 쓴다**(`private.posts_in_scope`).
-- 0024가 함수를 나누지 말라고 한 것은 **같은 질문**(글 목록)에 대해서였다.
-- 여기는 다른 질문(동네별 개수)이라 함수가 갈리는 것이 맞고, 갈리면 안 되는 것은 **조건**이다.
--
-- 순수 SQL·`setof`·단일 SELECT라 계획기가 **인라인**한다 — 그래서 `st_dwithin`이 여전히
-- `posts_location_gix`를 탄다. plpgsql로 적거나 `security definer`를 붙이면 인라인이 막혀
-- 반경 검색이 통째로 seq scan이 된다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 공유 필터 — private.posts_in_scope
--
-- 0024의 `search_posts` 안에 있던 WHERE를 그대로 옮겼다. 바뀐 것은 없다.
-- 중심(`p_center`)을 geography로 받는 이유는 부르는 쪽이 이미 만들어 두기 때문이다 —
-- 여기서 다시 만들면 위/경도 순서를 뒤집는 자리가 하나 더 생긴다.
-- -----------------------------------------------------------------------------
create or replace function private.posts_in_scope(
  p_region_code    text,
  p_center         geography,
  p_radius_m       integer,
  p_keyword        text,
  p_category_id    bigint,
  p_min_price      integer,
  p_max_price      integer,
  p_available_only boolean,
  p_blocked        uuid[]
)
returns setof posts
language sql
stable
as $$
  select p.*
    from posts p
   -- 기준 둘은 서로 배타적이지 않다. 안 쓰는 쪽은 null이라 통과할 뿐이다(0024).
   where (p_region_code is null or p.region_code = p_region_code)
     -- location이 null인 글(0005 이전)은 반경 기준에서 빠진다. st_dwithin이 null이라
     -- where가 통과시키지 않는다. 법정동 기준에는 영향이 없다.
     and (p_center is null or st_dwithin(p.location, p_center, p_radius_m))
     -- 검색 기준은 제품 이름(title)과 게시물 내용(description) 두 곳이다.
     and (
       p_keyword is null or btrim(p_keyword) = ''
       or p.title       ilike '%' || escape_like_pattern(btrim(p_keyword)) || '%'
       or p.description ilike '%' || escape_like_pattern(btrim(p_keyword)) || '%'
     )
     -- 대분류를 고르면 그 아래 소분류 글이 전부 걸린다.
     and (
       p_category_id is null
       or p.category_id = p_category_id
       or p.category_id in (select c.id from categories c where c.parent_id = p_category_id)
     )
     and (p_min_price is null or p.price >= p_min_price)
     and (p_max_price is null or p.price <= p_max_price)
     -- "거래 가능만 보기" = 판매완료만 숨긴다. 예약중은 아직 거래가 틀어질 수 있어 남긴다.
     and (not coalesce(p_available_only, false) or p.status <> 'sold')
     -- 차단 관계에 있는 사람의 글은 어느 목록에도 오지 않는다(0014).
     and p.seller_id <> all (p_blocked);
$$;

comment on function private.posts_in_scope is
  '목록·지도가 함께 쓰는 게시물 필터. 기준(법정동/반경)과 검색어·카테고리·가격·거래가능·차단을 한자리에 모았다. '
  '순수 SQL이라 계획기가 인라인해 st_dwithin이 GiST 인덱스를 탄다.';

grant execute on function private.posts_in_scope(
  text, geography, integer, text, bigint, integer, integer, boolean, uuid[]
) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. search_posts — 하는 일은 같고, 조건만 위 함수에서 가져온다
--
-- 인자·반환 모양은 0024 그대로다. 클라이언트는 한 줄도 바뀌지 않는다.
-- 남은 것은 이 함수가 **혼자 할 수 있는 일**뿐이다 — 정렬, keyset 커서, 페이지 크기.
--
-- 반환 모양이 그대로라 `create or replace`로 충분하지만, 0024가 겪은 자리라 한 번 더 적는다:
-- 인자나 반환이 바뀌면 옛 시그니처가 남아 PostgREST가 PGRST203으로 거절한다.
-- -----------------------------------------------------------------------------
create or replace function search_posts(
  p_region_code    text    default null,
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
  distance_m    double precision
)
language plpgsql
stable
as $$
declare
  v_column    text;
  v_direction text;
  v_type      text;
  v_compare   text;
  v_center    geography;
  v_radius    integer;
begin
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
      -- $2는 아래 using의 v_center다. 정렬 키가 컬럼이 아니라 식인 유일한 경우다.
      v_column := 'st_distance(p.location, $2)';
      v_direction := 'asc';
      v_type := 'double precision';
    else
      raise exception '알 수 없는 정렬 기준입니다: %', p_sort
        using errcode = 'invalid_parameter_value';
  end case;

  -- 내림차순이면 커서보다 작은 쪽이, 오름차순이면 큰 쪽이 다음 페이지다.
  v_compare := case when v_direction = 'desc' then '<' else '>' end;

  return query execute format(
    $q$
      select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
             p.like_count, p.view_count, p.bumped_at,
             -- 중심이 없으면(법정동 기준) null이 나온다. 따로 case로 가를 것이 없다.
             st_distance(p.location, $2) as distance_m
        from private.posts_in_scope($1, $2, $3, $4, $5, $6, $7, $8, $9) p
       -- keyset 커서. 정렬값 하나로는 같은 값을 가진 글이 페이지 경계에서 겹치거나 사라진다.
       -- 거리순에서는 이 tie-breaker가 거의 언제나 걸린다 — 같은 동 글은 거리가 전부 같다.
       where (
           $10 is null
           or %1$s %2$s $10::%3$s
           or (%1$s = $10::%3$s and p.id < $11)
         )
       order by %1$s %4$s, p.id desc
       limit $12
    $q$,
    v_column, v_compare, v_type, v_direction
  )
  using
    p_region_code,
    v_center,
    v_radius,
    p_keyword,
    p_category_id,
    p_min_price,
    p_max_price,
    p_available_only,
    private.blocked_user_ids(),
    p_cursor_value,
    -- 커서 id가 없으면 tie-breaker를 통과시키지 않는다(첫 페이지에는 $10도 null이라 무의미하다).
    coalesce(p_cursor_id, 0),
    -- 클라이언트가 보내는 값을 그대로 믿지 않는다.
    least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

comment on function search_posts is
  '게시물 목록. 기준은 법정동 코드(p_region_code)나 좌표+반경(p_lat·p_lng·p_radius_m) 중 하나이며 '
  '둘 다 주면 교집합이다. 조건은 private.posts_in_scope가 맡고(지도와 공유), 여기서는 정렬과 '
  '(정렬값, id) keyset 페이징만 한다. distance 정렬은 좌표가 있어야 쓸 수 있다.';

-- -----------------------------------------------------------------------------
-- 3. nearby_region_counts — 지도가 그리는 것
--
-- 좌표를 **반드시** 받는다. 법정동 기준에는 열지 않았다 — 내 동네 하나만 세는 지도는
-- 마커가 한 개뿐이라 지도일 이유가 없다. 반경은 지도의 전제이지 선택이 아니다.
--
-- 페이징이 없다. 반경 안의 동네는 많아야 수십 개이고, 지도는 **한눈에 보는 화면**이라
-- 절반만 그리면 "이쪽에는 물건이 없다"로 읽힌다. 대신 서버가 개수를 조인다(아래 v_limit).
--
-- ---------------------------------------------------------------------------
-- 묶는 키가 region_code **하나**인 이유 (실제 데이터를 보고 정했다)
--
-- 처음에는 (region_code, dong_name, location)으로 묶으려 했는데 둘 다 쪼개진다.
--
--   · **이름**: 같은 코드인데 표기가 다르다. `coord2RegionCode`는 "서울특별시 성북구 석관동",
--     `addressSearch`는 "서울 강북구 수유동"을 준다(카카오가 그렇게 내려준다).
--     이름까지 키에 넣으면 한 동네가 마커 둘로 갈린다.
--   · **좌표**: 동네를 고른 방법에 따라 다르다. GPS로 잡으면 카카오의 동 대표 좌표지만,
--     이름으로 검색하면 **그 지번의 좌표**가 들어온다(`fromAddressSearchResult`).
--     같은 동인데 몇백 미터 어긋난 점 여럿이 생긴다.
--
-- 그래서 코드로만 묶고, 이름은 **가장 많이 쓰인 표기**를, 좌표는 **평균**을 쓴다.
-- 평균이 맞는 이유는 이 마커가 애초에 한 점이 아니라 **한 무리를 대표하는 점**이라서다.
-- 거리도 그 평균점에서 잰다 — 마커가 놓인 자리와 적힌 거리가 어긋나면 안 된다.
-- -----------------------------------------------------------------------------
create or replace function nearby_region_counts(
  p_lat            double precision,
  p_lng            double precision,
  p_radius_m       integer default null,
  p_keyword        text    default null,
  p_category_id    bigint  default null,
  p_min_price      integer default null,
  p_max_price      integer default null,
  p_available_only boolean default false,
  p_limit          integer default 100
)
returns table (
  region_code text,
  dong_name   text,
  lat         double precision,
  lng         double precision,
  post_count  integer,
  distance_m  double precision
)
language plpgsql
stable
as $$
declare
  v_center geography;
  v_radius integer;
begin
  if p_lat is null or p_lng is null then
    raise exception '지도는 기준 좌표가 있어야 합니다.'
      using errcode = 'invalid_parameter_value';
  end if;

  v_center := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_radius := least(greatest(coalesce(p_radius_m, 2000), 100), 20000);

  return query
    select
      p.region_code,
      -- 표기가 갈릴 때 가장 흔한 것을 고른다. 같은 수면 사전순으로 앞선 것이다.
      mode() within group (order by p.dong_name)     as dong_name,
      avg(p.location_lat)                            as lat,
      avg(p.location_lng)                            as lng,
      count(*)::integer                              as post_count,
      st_distance(
        st_setsrid(st_makepoint(avg(p.location_lng), avg(p.location_lat)), 4326)::geography,
        v_center
      )                                              as distance_m
      from private.posts_in_scope(
             null, v_center, v_radius,
             p_keyword, p_category_id, p_min_price, p_max_price, p_available_only,
             private.blocked_user_ids()
           ) p
     -- 반경 기준이라 location이 null인 글은 이미 빠졌지만, region_code가 빈 옛 글이 있으면
     -- "이름 없는 동네" 마커가 생긴다. 그릴 수 없는 것은 세지도 않는다.
     where p.region_code is not null
     group by p.region_code
     -- 가까운 동네부터. 잘릴 때 잘리는 쪽이 먼 동네여야 한다.
     order by distance_m asc, p.region_code asc
     limit least(greatest(coalesce(p_limit, 100), 1), 300);
end;
$$;

comment on function nearby_region_counts is
  '반경 안의 법정동별 게시물 수. 지도의 마커 한 개가 이 함수의 한 행이다. '
  '조건은 search_posts와 같은 private.posts_in_scope를 쓰므로 목록과 개수가 어긋나지 않는다. '
  '같은 코드라도 이름 표기와 좌표가 갈릴 수 있어 코드로만 묶고 이름은 최빈값, 좌표는 평균을 쓴다.';
