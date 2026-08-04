-- =============================================================================
-- 목록 정렬 (최신 · 조회순 · 찜순 · 가격순)
--
-- 0007의 search_posts는 정렬이 `bumped_at desc, id desc` 하나로 못 박혀 있었다.
-- feature.md §2.2가 요구하는 "조회수별·방금전·찜 많은 순·가격" 정렬을 붙인다.
--
-- 어려운 곳은 정렬이 아니라 **커서**다. keyset 페이징은 "마지막으로 읽은 행"을 정렬 기준
-- 컬럼으로 표현하는데, 정렬 기준이 바뀌면 그 컬럼도 같이 바뀐다. 그래서 0007이 들고 있던
-- p_cursor_bumped_at(timestamptz) 자리를 **정렬 컬럼이 무엇이든 담을 수 있는 text 한 칸**으로
-- 바꾸고, 서버가 정렬 기준에 맞는 타입으로 캐스팅해 비교한다.
-- 클라이언트는 "직전 페이지 마지막 글의 정렬값"을 문자열로 넘기기만 하면 된다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 옛 시그니처를 먼저 지운다
--
-- create or replace는 **인자 목록이 다르면 교체가 아니라 오버로드**다. 그냥 두면 search_posts가
-- 두 개 남고, PostgREST가 공통 인자(p_region_code)만 담긴 요청을 받았을 때 어느 쪽인지 고르지
-- 못해 PGRST203으로 거절한다.
-- -----------------------------------------------------------------------------
drop function if exists search_posts(
  text, text, bigint, integer, integer, boolean, timestamptz, bigint, integer
);

-- -----------------------------------------------------------------------------
-- 2. 정렬을 받는 search_posts
--
-- 본문이 동적 SQL이다. 이유는 인덱스다.
--   order by case p_sort when 'popular' then p.view_count ... end
-- 처럼 표현식으로 정렬하면 어떤 인덱스도 그 표현식과 맞지 않아 동네 글 전체를 읽고 정렬한다.
-- 정렬 컬럼을 쿼리 문자열에 박아 넣어야 아래 3번의 복합 인덱스를 그대로 탄다.
--
-- 주입 걱정은 없다. p_sort는 **컬럼명을 만들어 내지 않고 화이트리스트에서 고르기만** 하며,
-- 목록에 없는 값은 거절한다. 사용자 입력(검색어·가격·커서)은 전부 $n 파라미터로 바인딩된다.
--
-- 정렬 방향이 무엇이든 tie-breaker는 언제나 `id desc`다. 가격 오름차순도 마찬가지 —
-- 같은 가격 안에서는 새 글이 먼저 보이는 편이 자연스럽고, 커서 비교도 한 방향으로 통일된다.
-- -----------------------------------------------------------------------------
create or replace function search_posts(
  p_region_code    text,
  p_keyword        text    default null,
  p_category_id    bigint  default null,   -- 대분류·소분류 아무거나 받는다
  p_min_price      integer default null,
  p_max_price      integer default null,
  p_available_only boolean default false,
  p_sort           text    default 'latest',
  p_cursor_value   text    default null,   -- 이전 페이지 마지막 행의 정렬값
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
  v_column    text;   -- 정렬 컬럼
  v_direction text;   -- asc | desc
  v_type      text;   -- 커서 문자열을 되돌릴 타입
  v_compare   text;   -- 커서보다 "뒤"를 뜻하는 부등호
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
    least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

comment on function search_posts is
  '내 동네(region_code) 안에서 검색어·카테고리·가격구간·거래가능 필터를 모두 중첩 적용한 목록. '
  'p_sort로 정렬(latest·popular·likes·price_asc·price_desc)을 고르고, (정렬값, id) keyset 페이징한다.';

-- -----------------------------------------------------------------------------
-- 3. 정렬 기준마다 인덱스 하나
--
-- 커서 조건과 order by가 모두 `(정렬컬럼 방향, id desc)`라, 인덱스도 같은 모양이어야 정렬
-- 없이 앞에서부터 limit개만 읽고 끝난다. 방향까지 같아야 한다 —
-- (price asc, id desc)를 거꾸로 읽으면 (price desc, id asc)가 되어 tie-breaker가 어긋난다.
-- 그래서 가격은 오름·내림 두 벌을 만든다.
--
-- 최신순은 0007의 posts_region_keyset_idx가 이미 같은 모양이라 그대로 쓴다.
-- -----------------------------------------------------------------------------
create index if not exists posts_region_views_idx
  on posts (region_code, view_count desc, id desc);

create index if not exists posts_region_likes_idx
  on posts (region_code, like_count desc, id desc);

create index if not exists posts_region_price_asc_idx
  on posts (region_code, price asc, id desc);

create index if not exists posts_region_price_desc_idx
  on posts (region_code, price desc, id desc);

-- 0007의 posts_region_price_idx(region_code, price)는 위 오름차순 인덱스가 앞부분을 그대로
-- 품고 있다. 가격 필터도 그쪽이 처리하므로 남겨 둘 이유가 없다.
drop index if exists posts_region_price_idx;
