-- =============================================================================
-- 0028_comment_count.sql — 목록 카드에 댓글 수
--
-- `backlog.md` §4. 0017이 댓글을, 대댓글이 답글을 붙였지만 **목록에서는 그 사실이 전혀
-- 보이지 않았다.** 상세로 들어가야만 댓글이 달렸는지 알 수 있다.
--
-- -----------------------------------------------------------------------------
-- 왜 조인이 아니라 컬럼인가
--
-- 0005가 `like_count`에서 이미 정한 방식이다 — 목록에서 글마다 `count(*)`를 세면 비싸고,
-- 컬럼이면 정렬·필터로 쓸 여지도 남는다. 댓글은 찜보다 자주 달리지도 않는다.
--
-- **대댓글도 함께 센다.** 카드에 적히는 "댓글 3"은 그 글에 달린 말의 개수이지 1단만 센 값이
-- 아니다. 화면에서도 답글은 부모 밑에 붙어 한 덩어리로 읽힌다(대댓글 구현 참고).
--
-- -----------------------------------------------------------------------------
-- 이 마이그레이션이 긴 이유 — 목록 RPC가 여섯이다
--
-- `PostCard`를 홈·검색과 마이페이지가 **함께 쓴다**("같은 게시물이 화면마다 다르게 보일
-- 이유가 없다"고 그 컴포넌트가 적어 두었다). 그래서 한 곳만 고치면 **마이페이지 카드만 늘
-- "댓글 0"으로 거짓말을 한다.**
--
-- 목록 요약 모양을 돌려주는 함수가 여섯이고, 전부 `returns table`이라 반환 모양이 바뀌면
-- `create or replace`가 통하지 않는다 — 하나하나 `drop` 후 다시 만든다(0024에서 겪은 자리다).
--
--   search_posts · fetch_liked_posts · fetch_purchased_posts
--   fetch_recently_viewed_posts · fetch_selling_posts · fetch_user_posts
--
-- 컬럼·트리거·백필은 쉬운 쪽이고 이 반복이 이 일의 실제 크기다.
-- 여섯이 같은 모양을 베껴 쓰고 있다는 것 자체가 부채지만, 합치는 일은 이번 범위가 아니다.
--
-- -----------------------------------------------------------------------------
-- 0020 덕분에 안 해도 되는 일 하나
--
-- `posts_set_updated_at`을 건드리지 않는다. 0020이 그 트리거를 **제외 목록에서 포함 목록으로
-- 뒤집어** 두었기 때문이다. 제외 목록이었다면 여기에 `comment_count`를 더해 주지 않는 순간
-- **댓글이 달릴 때마다 "수정됨"이 뜬다.** 그때 적어 둔 "앞으로 칸이 늘어도 기본값이 수정
-- 아님"이 이번에 실제로 값을 했다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 컬럼
-- -----------------------------------------------------------------------------
alter table posts add column if not exists comment_count integer not null default 0;

comment on column posts.comment_count is
  '댓글 개수(대댓글 포함). comments 트리거가 유지한다. 직접 쓰지 않는다.';

-- -----------------------------------------------------------------------------
-- 2. 집계 트리거
--
-- `security definer`가 필요하다. 댓글은 **남의 글에** 달리는데 `posts_update` 정책이
-- `auth.uid() = seller_id`라 호출자 권한으로는 그 글을 갱신할 수 없다(0005의 찜과 같다).
--
-- update는 걸지 않는다. 0020의 `guard_comment_update`가 `post_id` 변경을 이미 막고 있어
-- 댓글이 다른 글로 옮겨 갈 길이 없다 — 옮겨 갈 수 있었다면 양쪽 글의 수를 함께 고쳐야 한다.
--
-- 글이 지워질 때는 댓글이 cascade로 함께 지워지며 이 트리거가 돌지만, 그 글은 이미 사라지는
-- 중이라 `update ... where id = old.post_id`가 0행을 고치고 끝난다. 찜도 같은 자리다.
-- -----------------------------------------------------------------------------
create or replace function sync_post_comment_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    -- greatest로 바닥을 둔다. 어긋나더라도 음수가 화면에 적히는 것보다 낫다.
    update posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;

  return null;   -- after 트리거라 반환값은 쓰이지 않는다.
end;
$$;

drop trigger if exists comments_after_change on comments;
create trigger comments_after_change
  after insert or delete on comments
  for each row execute function sync_post_comment_count();

-- 컬럼을 새로 만들었으니 이미 달린 댓글과 한 번 맞춰 둔다.
update posts p
   set comment_count = (select count(*) from comments c where c.post_id = p.id)
 where p.comment_count is distinct from (select count(*) from comments c where c.post_id = p.id);

-- -----------------------------------------------------------------------------
-- 3. 목록 RPC 여섯 — 반환 모양에 comment_count를 더한다
--
-- 아래 다섯은 0009·0012가 만든 것을 그대로 두고 칸 하나만 늘렸다. 조건·정렬·커서는 손대지 않았다.
-- -----------------------------------------------------------------------------
drop function if exists fetch_liked_posts(timestamptz, bigint, integer);
create function fetch_liked_posts(
  p_cursor_at timestamptz default null,
  p_cursor_id bigint default null,
  p_limit integer default 20
)
returns table (
  id bigint, title text, price integer, status post_status, thumbnail_url text,
  dong_name text, like_count integer, view_count integer, comment_count integer,
  bumped_at timestamptz, sort_at timestamptz
)
language sql
stable
as $$
  select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
         p.like_count, p.view_count, p.comment_count, p.bumped_at,
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

drop function if exists fetch_purchased_posts(timestamptz, bigint, integer);
create function fetch_purchased_posts(
  p_cursor_at timestamptz default null,
  p_cursor_id bigint default null,
  p_limit integer default 20
)
returns table (
  id bigint, title text, price integer, status post_status, thumbnail_url text,
  dong_name text, like_count integer, view_count integer, comment_count integer,
  bumped_at timestamptz, sort_at timestamptz
)
language sql
stable
as $$
  select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
         p.like_count, p.view_count, p.comment_count, p.bumped_at,
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

drop function if exists fetch_recently_viewed_posts(timestamptz, bigint, integer);
create function fetch_recently_viewed_posts(
  p_cursor_at timestamptz default null,
  p_cursor_id bigint default null,
  p_limit integer default 20
)
returns table (
  id bigint, title text, price integer, status post_status, thumbnail_url text,
  dong_name text, like_count integer, view_count integer, comment_count integer,
  bumped_at timestamptz, sort_at timestamptz
)
language sql
stable
as $$
  select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
         p.like_count, p.view_count, p.comment_count, p.bumped_at,
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

drop function if exists fetch_selling_posts(post_status, timestamptz, bigint, integer);
create function fetch_selling_posts(
  p_status post_status default null,
  p_cursor_at timestamptz default null,
  p_cursor_id bigint default null,
  p_limit integer default 20
)
returns table (
  id bigint, title text, price integer, status post_status, thumbnail_url text,
  dong_name text, like_count integer, view_count integer, comment_count integer,
  bumped_at timestamptz, sort_at timestamptz
)
language sql
stable
as $$
  select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
         p.like_count, p.view_count, p.comment_count, p.bumped_at,
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

drop function if exists fetch_user_posts(uuid, timestamptz, bigint, integer);
create function fetch_user_posts(
  p_user_id uuid,
  p_cursor_at timestamptz default null,
  p_cursor_id bigint default null,
  p_limit integer default 20
)
returns table (
  id bigint, title text, price integer, status post_status, thumbnail_url text,
  dong_name text, like_count integer, view_count integer, comment_count integer,
  bumped_at timestamptz, sort_at timestamptz
)
language sql
stable
as $$
  select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
         p.like_count, p.view_count, p.comment_count, p.bumped_at,
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

-- -----------------------------------------------------------------------------
-- 4. search_posts — 0025 그대로에 칸 하나만 더한다
--
-- 조건은 여전히 `private.posts_in_scope`가 맡고(0025), 여기서는 정렬과 keyset만 한다.
-- 몸통을 다시 적는 이유는 반환 모양이 바뀌어 drop이 필요하기 때문이지 로직이 바뀌어서가 아니다.
-- -----------------------------------------------------------------------------
drop function if exists search_posts(
  text, double precision, double precision, integer, text, bigint,
  integer, integer, boolean, text, text, bigint, integer
);
create function search_posts(
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
  comment_count integer,
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
      v_column := 'st_distance(p.location, $2)';
      v_direction := 'asc';
      v_type := 'double precision';
    else
      raise exception '알 수 없는 정렬 기준입니다: %', p_sort
        using errcode = 'invalid_parameter_value';
  end case;

  v_compare := case when v_direction = 'desc' then '<' else '>' end;

  return query execute format(
    $q$
      select p.id, p.title, p.price, p.status, p.thumbnail_url, p.dong_name,
             p.like_count, p.view_count, p.comment_count, p.bumped_at,
             st_distance(p.location, $2) as distance_m
        from private.posts_in_scope($1, $2, $3, $4, $5, $6, $7, $8, $9) p
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
    coalesce(p_cursor_id, 0),
    least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

comment on function search_posts is
  '게시물 목록. 기준은 법정동 코드(p_region_code)나 좌표+반경(p_lat·p_lng·p_radius_m) 중 하나이며 '
  '둘 다 주면 교집합이다. 조건은 private.posts_in_scope가 맡고(지도와 공유), 여기서는 정렬과 '
  '(정렬값, id) keyset 페이징만 한다. distance 정렬은 좌표가 있어야 쓸 수 있다.';
