-- =============================================================================
-- 게시물 등록 — 동네/거래희망장소 좌표, 찜 집계, 조회수, 사진 저장소
--
-- posts 뼈대(제목·설명·가격·카테고리·상태·썸네일·조회수)는 0001에서 이미 만들었다.
-- 여기서 채우는 것은 "어느 동네 글인가", "어디서 만나기로 했나", "찜이 몇 개인가"다.
--
-- 좌표 두 개는 성격이 다르니 컬럼도 나눈다.
--   location       = 판매자 동네 대표 좌표. 목록·반경 검색(nearby_posts)의 기준이다.
--   trade_location = 거래희망장소 좌표. 상세 화면에서만 쓰는 부가 정보다.
-- 거래장소를 location에 넣으면 "옆 동네 카페에서 만나기로 한 글"이 그 동네 글이 되어버린다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- posts 컬럼
-- -----------------------------------------------------------------------------
alter table posts
  add column if not exists region_code    text,
  add column if not exists dong_name      text,
  add column if not exists trade_location geography(Point, 4326),
  add column if not exists like_count     integer not null default 0;

-- geography는 select하면 EWKB hex로 와서 클라이언트가 쓸 수 없다.
-- 0003에서 profiles에 쓴 방법 그대로, 좌표는 생성 컬럼으로 노출한다.
-- (쓰기는 geography 컬럼 한 곳뿐이라 파생값이 어긋날 수 없다.)
alter table posts
  add column if not exists location_lat double precision
    generated always as (st_y(location::geometry)) stored,
  add column if not exists location_lng double precision
    generated always as (st_x(location::geometry)) stored,
  add column if not exists trade_location_lat double precision
    generated always as (st_y(trade_location::geometry)) stored,
  add column if not exists trade_location_lng double precision
    generated always as (st_x(trade_location::geometry)) stored;

-- 내 동네 최신순 목록이 가장 잦은 조회다. 정렬 컬럼까지 인덱스에 넣는다.
create index if not exists posts_region_code_idx    on posts (region_code, bumped_at desc);
create index if not exists posts_seller_idx         on posts (seller_id, bumped_at desc);
create index if not exists posts_trade_location_gix on posts using gist (trade_location);
create index if not exists posts_like_count_idx     on posts (like_count desc);

comment on column posts.region_code    is '판매자 동네 법정동 코드(profiles.region_code 복사본). 같은 동네 목록의 기준.';
comment on column posts.dong_name      is '표시용 동네 이름. 예: "서울특별시 강북구 수유동"';
comment on column posts.location       is '판매자 동네 대표 좌표. 거래희망장소가 아니다.';
comment on column posts.trade_location is '거래희망장소 좌표. 장소를 고르지 않으면 null.';
comment on column posts.like_count     is '찜 개수. likes 트리거가 유지한다. 직접 쓰지 않는다.';

-- -----------------------------------------------------------------------------
-- 찜 개수 집계
--
-- 매번 count(*)를 세지 않고 컬럼으로 들고 있는다 — 목록에서 글마다 세면 비싸고,
-- "찜 많은 순" 정렬(feature.md 2.2)을 인덱스로 처리할 수 있다.
--
-- security definer가 필요하다. 찜하는 사람은 남의 글에 찜을 하는데,
-- posts_update 정책이 `auth.uid() = seller_id`라 호출자 권한으로는 그 글을 갱신할 수 없다.
-- -----------------------------------------------------------------------------
create or replace function sync_post_like_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
  else
    update posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;

  return null;   -- after 트리거라 반환값은 쓰이지 않는다.
end;
$$;

drop trigger if exists likes_after_change on likes;
create trigger likes_after_change
  after insert or delete on likes
  for each row execute function sync_post_like_count();

-- 컬럼을 새로 만들었으니 기존 찜과 한 번 맞춰 둔다.
update posts p
   set like_count = (select count(*) from likes l where l.post_id = p.id)
 where p.like_count is distinct from (select count(*) from likes l where l.post_id = p.id);

-- -----------------------------------------------------------------------------
-- 조회수
--
-- 0001의 increment_view_count는 `language sql`(security invoker)이라 호출자 권한으로
-- posts를 update한다. posts_update 정책이 작성자만 허용하므로 **남의 글 조회수는
-- 조용히 0행 갱신되고 끝난다** — 오류도 안 난다. definer로 바꿔야 실제로 올라간다.
--
-- 본인 글 제외 규칙도 여기서 막는다. 클라이언트(탭 세션당 1회 가드)만 믿으면
-- 판매자가 자기 글을 새로고침해 조회수를 부풀릴 수 있다.
-- -----------------------------------------------------------------------------
create or replace function increment_view_count(p_post_id bigint)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update posts
     set view_count = view_count + 1
   where id = p_post_id
     and (auth.uid() is null or seller_id <> auth.uid());
end;
$$;

-- updated_at은 "판매자가 글을 고친 시각"이어야 한다.
-- 남이 보거나(view_count) 찜해서(like_count) 바뀐 것은 수정이 아니므로 제외한다.
-- 두 컬럼 모두 그대로일 때만 갱신한다.
drop trigger if exists posts_set_updated_at on posts;
create trigger posts_set_updated_at
  before update on posts
  for each row when (
    old.view_count is not distinct from new.view_count
    and old.like_count is not distinct from new.like_count
  )
  execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- 게시물 사진 저장소
-- 0002의 avatars 버킷과 같은 규칙: 조회는 공개, 쓰기는 본인 폴더({user_id}/...)만.
-- 상품 사진은 프로필 사진보다 크므로 5MB로 잡는다.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880,                                                   -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists post_images_select     on storage.objects;
drop policy if exists post_images_insert_own on storage.objects;
drop policy if exists post_images_update_own on storage.objects;
drop policy if exists post_images_delete_own on storage.objects;

create policy post_images_select on storage.objects
  for select
  using (bucket_id = 'post-images');

create policy post_images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy post_images_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy post_images_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
