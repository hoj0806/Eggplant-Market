-- =============================================================================
-- 게시물 검색 및 필터링 — 내 동네 안에서 검색어·카테고리·가격·거래가능을 모두 겹쳐 건다.
--
-- 필터를 PostgREST 쿼리 빌더로 조립할 수도 있었다. 제목·본문 두 컬럼을 OR로 묶으려면
-- `.or('title.ilike.%키워드%,description.ilike.%키워드%')`처럼 **필터를 문자열로** 만들어야 하는데,
-- 사용자가 검색창에 `,` `.` `(` `)` `"`를 치는 순간 그 문자열의 문법이 깨진다.
-- 값이 파라미터로 바인딩되는 RPC 하나로 가는 편이 안전하고, 0001의 nearby_posts와도 결이 같다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- LIKE 와일드카드 무력화
--
-- 검색어는 패턴이 아니라 글자 그대로여야 한다. 이 함수가 없으면 `%`만 친 사용자에게
-- 동네 글 전체가 나오고, `_`는 아무 한 글자에나 걸린다.
-- 역슬래시를 먼저 늘려야 한다 — 순서를 바꾸면 우리가 붙인 이스케이프까지 다시 이스케이프된다.
-- -----------------------------------------------------------------------------
create or replace function escape_like_pattern(p_text text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_');
$$;

comment on function escape_like_pattern(text) is
  'LIKE/ILIKE 패턴에서 특수문자(\ % _)를 글자 그대로 취급하도록 이스케이프한다.';

-- -----------------------------------------------------------------------------
-- 검색 + 필터 + 무한스크롤
--
-- 파라미터는 전부 "주지 않으면 거는 조건이 없다"는 규칙이다. 그래서 아무것도 넘기지 않으면
-- 내 동네 최신 글 목록(= fetchNeighborhoodPosts와 같은 결과)이 나온다.
--
-- security definer를 쓰지 않는다. 호출자 권한으로 돌아야 posts_select(using true) 정책이
-- 그대로 적용된다 — 비로그인(anon)도 그 정책으로 읽으므로 따로 손댈 것이 없다.
-- -----------------------------------------------------------------------------
create or replace function search_posts(
  p_region_code      text,
  p_keyword          text        default null,
  p_category_id      bigint      default null,   -- 대분류·소분류 아무거나 받는다
  p_min_price        integer     default null,
  p_max_price        integer     default null,
  p_available_only   boolean     default false,
  p_cursor_bumped_at timestamptz default null,   -- 이전 페이지 마지막 행
  p_cursor_id        bigint      default null,
  p_limit            integer     default 20
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
language sql
stable
as $$
  select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
         p.like_count, p.view_count, p.bumped_at
    from posts p
   where p.region_code = p_region_code
     -- 검색 기준은 제품 이름(title)과 게시물 내용(description) 두 곳이다.
     and (
       p_keyword is null or btrim(p_keyword) = ''
       or p.title       ilike '%' || escape_like_pattern(btrim(p_keyword)) || '%'
       or p.description ilike '%' || escape_like_pattern(btrim(p_keyword)) || '%'
     )
     -- 대분류를 고르면 그 아래 소분류 글이 전부 걸려야 한다. 게시물은 언제나 소분류에 붙지만
     -- 필터는 "디지털/가전 전체"처럼 넓게 거는 쪽이 쓸모 있다.
     and (
       p_category_id is null
       or p.category_id = p_category_id
       or p.category_id in (select c.id from categories c where c.parent_id = p_category_id)
     )
     and (p_min_price is null or p.price >= p_min_price)
     and (p_max_price is null or p.price <= p_max_price)
     -- "거래 가능만 보기" = 판매완료만 숨긴다. 예약중은 아직 거래가 틀어질 수 있어 남긴다.
     and (not coalesce(p_available_only, false) or p.status <> 'sold')
     -- keyset 커서. bumped_at 하나로는 같은 시각 글이 페이지 경계에서 겹치거나 사라진다.
     and (
       p_cursor_bumped_at is null
       or p.bumped_at < p_cursor_bumped_at
       or (p.bumped_at = p_cursor_bumped_at and p.id < coalesce(p_cursor_id, 0))
     )
   order by p.bumped_at desc, p.id desc
   -- 클라이언트가 보내는 값을 그대로 믿지 않는다.
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function search_posts is
  '내 동네(region_code) 안에서 검색어·카테고리·가격구간·거래가능 필터를 모두 중첩 적용한 목록. (bumped_at, id) keyset 페이징.';

-- -----------------------------------------------------------------------------
-- 인덱스
--
-- 0001에 title trgm 인덱스는 있으나 본문 검색용이 없다. ILIKE '%…%'는 trgm GIN이 없으면
-- 전부 순차 스캔이다.
-- -----------------------------------------------------------------------------
create index if not exists posts_description_trgm_idx
  on posts using gin (description gin_trgm_ops);

-- 목록의 기본 동선(동네 → 최신순 → 커서)을 인덱스 하나로 덮는다.
-- 0005의 posts_region_code_idx(region_code, bumped_at desc)에 커서 tie-breaker인 id를 더한 것이다.
create index if not exists posts_region_keyset_idx
  on posts (region_code, bumped_at desc, id desc);

create index if not exists posts_region_price_idx
  on posts (region_code, price);
