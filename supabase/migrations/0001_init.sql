-- =============================================================================
-- EggPlant Market (당근마켓 클론) — 초기 스키마
-- Postgres / Supabase. 거리 기반 "내 동네 + 반경" 검색을 위해 PostGIS 사용.
-- 모든 테이블에 RLS 활성화. 앱은 mock 데이터 없이 이 스키마의 실제 데이터를 사용한다.
-- =============================================================================

-- 확장 -------------------------------------------------------------------------
create extension if not exists postgis;
create extension if not exists pg_trgm;      -- 제목/설명 검색(ILIKE, 유사도)

-- 열거형(Enum) -----------------------------------------------------------------
create type post_status        as enum ('selling', 'reserved', 'sold');
create type message_type       as enum ('text', 'image', 'price_offer');
create type offer_status       as enum ('pending', 'accepted', 'rejected');
create type notification_type  as enum ('comment', 'like', 'chat', 'review', 'price_offer');
create type report_target      as enum ('post', 'user');

-- =============================================================================
-- 공용 함수: updated_at 자동 갱신
-- =============================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- profiles : auth.users 1:1 확장
-- =============================================================================
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  nickname        text not null unique,
  avatar_url      text,
  manner_temp     numeric(4, 1) not null default 36.5,
  location        geography(Point, 4326),          -- 내 동네 좌표
  dong_name       text,                            -- 예: "서울시 강남구 역삼동"
  search_radius_m integer not null default 2000,   -- 검색 반경(미터)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index profiles_location_gix on profiles using gist (location);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- 신규 가입 시 profiles 자동 생성 (닉네임은 임시값 → 온보딩에서 갱신)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, 'user_' || substr(new.id::text, 1, 8));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================================
-- categories : 시드 고정값
-- =============================================================================
create table categories (
  id         bigint generated always as identity primary key,
  name       text not null,
  slug       text not null unique,
  sort_order integer not null default 0
);

-- =============================================================================
-- posts : 게시물
-- =============================================================================
create table posts (
  id                  bigint generated always as identity primary key,
  seller_id           uuid not null references profiles (id) on delete cascade,
  title               text not null,
  description         text not null,
  price               integer not null default 0,
  category_id         bigint references categories (id),
  status              post_status not null default 'selling',
  trade_location_text text,
  location            geography(Point, 4326),
  thumbnail_url       text,
  view_count          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  bumped_at           timestamptz not null default now()   -- 끌올/방금전 정렬 기준
);
create index posts_location_gix   on posts using gist (location);
create index posts_bumped_at_idx  on posts (bumped_at desc);
create index posts_category_idx   on posts (category_id);
create index posts_status_idx     on posts (status);
create index posts_title_trgm_idx on posts using gin (title gin_trgm_ops);

create trigger posts_set_updated_at
  before update on posts
  for each row execute function set_updated_at();

-- 게시물 이미지 (1:N)
create table post_images (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references posts (id) on delete cascade,
  url        text not null,
  sort_order integer not null default 0
);
create index post_images_post_idx on post_images (post_id);

-- 조회수 증가 (상세 진입 시 호출)
create or replace function increment_view_count(p_post_id bigint)
returns void
language sql
as $$
  update posts set view_count = view_count + 1 where id = p_post_id;
$$;

-- =============================================================================
-- likes : 찜
-- =============================================================================
create table likes (
  user_id    uuid not null references profiles (id) on delete cascade,
  post_id    bigint not null references posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index likes_post_idx on likes (post_id);

-- =============================================================================
-- comments : 댓글(대댓글 지원)
-- =============================================================================
create table comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references posts (id) on delete cascade,
  author_id  uuid not null references profiles (id) on delete cascade,
  parent_id  bigint references comments (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index comments_post_idx   on comments (post_id);
create index comments_parent_idx on comments (parent_id);

-- =============================================================================
-- chat_rooms / messages : 게시물당 1:1 채팅방
-- =============================================================================
create table chat_rooms (
  id              bigint generated always as identity primary key,
  post_id         bigint not null references posts (id) on delete cascade,
  buyer_id        uuid not null references profiles (id) on delete cascade,
  seller_id       uuid not null references profiles (id) on delete cascade,
  last_message    text,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (post_id, buyer_id)
);
create index chat_rooms_buyer_idx  on chat_rooms (buyer_id);
create index chat_rooms_seller_idx on chat_rooms (seller_id);

create table messages (
  id           bigint generated always as identity primary key,
  room_id      bigint not null references chat_rooms (id) on delete cascade,
  sender_id    uuid not null references profiles (id) on delete cascade,
  type         message_type not null default 'text',
  content      text,
  offer_amount integer,                          -- type = price_offer 일 때
  offer_status offer_status,                     -- pending/accepted/rejected
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index messages_room_idx on messages (room_id, created_at);

-- 메시지 생성 시 채팅방 요약 갱신 + 상대에게 알림
create or replace function on_message_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_recipient uuid;
  v_summary   text;
begin
  v_summary := coalesce(new.content,
               case when new.type = 'price_offer'
                    then (new.offer_amount::text || '원 제안') else '(메시지)' end);

  update chat_rooms
     set last_message = v_summary, last_message_at = new.created_at
   where id = new.room_id;

  select case when buyer_id = new.sender_id then seller_id else buyer_id end
    into v_recipient
    from chat_rooms where id = new.room_id;

  insert into notifications (user_id, type, payload)
  values (v_recipient,
          case when new.type = 'price_offer' then 'price_offer'::notification_type
               else 'chat'::notification_type end,
          jsonb_build_object('room_id', new.room_id, 'message_id', new.id));

  return new;
end;
$$;

create trigger messages_after_insert
  after insert on messages
  for each row execute function on_message_insert();

-- =============================================================================
-- reviews : 거래후기 → 매너온도
-- =============================================================================
create table reviews (
  id          bigint generated always as identity primary key,
  post_id     bigint not null references posts (id) on delete cascade,
  reviewer_id uuid not null references profiles (id) on delete cascade,
  reviewee_id uuid not null references profiles (id) on delete cascade,
  manner_tags text[] not null default '{}',
  score       numeric(3, 1) not null default 0,   -- 이번 거래 가감치(예: +0.5, -1.0)
  comment     text,
  created_at  timestamptz not null default now(),
  unique (post_id, reviewer_id)
);
create index reviews_reviewee_idx on reviews (reviewee_id);

-- 후기 생성 시 매너온도 재계산(0~99 범위로 클램프)
create or replace function recalc_manner_temp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update profiles
     set manner_temp = greatest(0, least(99, manner_temp + new.score))
   where id = new.reviewee_id;

  insert into notifications (user_id, type, payload)
  values (new.reviewee_id, 'review',
          jsonb_build_object('post_id', new.post_id, 'review_id', new.id));

  return new;
end;
$$;

create trigger reviews_after_insert
  after insert on reviews
  for each row execute function recalc_manner_temp();

-- =============================================================================
-- notifications : 알림 (Realtime)
-- =============================================================================
create table notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles (id) on delete cascade,
  type       notification_type not null,
  payload    jsonb not null default '{}',
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);

-- =============================================================================
-- blocks : 사용자 차단
-- =============================================================================
create table blocks (
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- =============================================================================
-- reports : 신고
-- =============================================================================
create table reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid not null references profiles (id) on delete cascade,
  target_type report_target not null,
  target_id   text not null,           -- post_id 또는 user_id(uuid)
  reason      text not null,
  detail      text,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- recently_viewed : 최근 본 상품 (upsert로 viewed_at 갱신)
-- =============================================================================
create table recently_viewed (
  user_id   uuid not null references profiles (id) on delete cascade,
  post_id   bigint not null references posts (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index recently_viewed_user_idx on recently_viewed (user_id, viewed_at desc);

-- =============================================================================
-- 반경 내 게시물 검색 RPC (무한스크롤: keyset 커서 = bumped_at)
-- =============================================================================
create or replace function nearby_posts(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_m   integer default 2000,
  p_category   bigint  default null,
  p_cursor     timestamptz default null,   -- 이전 페이지 마지막 bumped_at
  p_limit      integer default 20
)
returns setof posts
language sql
stable
as $$
  select p.*
    from posts p
   where st_dwithin(
           p.location,
           st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
           p_radius_m)
     and (p_category is null or p.category_id = p_category)
     and (p_cursor is null or p.bumped_at < p_cursor)
   order by p.bumped_at desc
   limit p_limit;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table profiles        enable row level security;
alter table posts           enable row level security;
alter table post_images     enable row level security;
alter table likes           enable row level security;
alter table comments        enable row level security;
alter table chat_rooms      enable row level security;
alter table messages        enable row level security;
alter table reviews         enable row level security;
alter table notifications   enable row level security;
alter table blocks          enable row level security;
alter table reports         enable row level security;
alter table recently_viewed enable row level security;
alter table categories      enable row level security;

-- categories : 누구나 조회
create policy categories_select on categories for select using (true);

-- profiles : 조회 공개, 본인만 수정
create policy profiles_select on profiles for select using (true);
create policy profiles_update on profiles for update using (auth.uid() = id);

-- posts : 조회 공개, 로그인 사용자 생성, 작성자만 수정/삭제
create policy posts_select on posts for select using (true);
create policy posts_insert on posts for insert with check (auth.uid() = seller_id);
create policy posts_update on posts for update using (auth.uid() = seller_id);
create policy posts_delete on posts for delete using (auth.uid() = seller_id);

-- post_images : 조회 공개, 게시물 소유자만 쓰기
create policy post_images_select on post_images for select using (true);
create policy post_images_write on post_images for all
  using (exists (select 1 from posts where posts.id = post_images.post_id and posts.seller_id = auth.uid()))
  with check (exists (select 1 from posts where posts.id = post_images.post_id and posts.seller_id = auth.uid()));

-- likes : 조회 공개, 본인 것만 추가/삭제
create policy likes_select on likes for select using (true);
create policy likes_insert on likes for insert with check (auth.uid() = user_id);
create policy likes_delete on likes for delete using (auth.uid() = user_id);

-- comments : 조회 공개, 로그인 사용자 작성, 작성자만 수정/삭제
create policy comments_select on comments for select using (true);
create policy comments_insert on comments for insert with check (auth.uid() = author_id);
create policy comments_update on comments for update using (auth.uid() = author_id);
create policy comments_delete on comments for delete using (auth.uid() = author_id);

-- chat_rooms : 참여자만 조회/생성
create policy chat_rooms_select on chat_rooms for select
  using (auth.uid() in (buyer_id, seller_id));
create policy chat_rooms_insert on chat_rooms for insert
  with check (auth.uid() = buyer_id);

-- messages : 방 참여자만 조회, 발신자 본인만 전송
create policy messages_select on messages for select
  using (exists (select 1 from chat_rooms r
                  where r.id = messages.room_id
                    and auth.uid() in (r.buyer_id, r.seller_id)));
create policy messages_insert on messages for insert
  with check (auth.uid() = sender_id
              and exists (select 1 from chat_rooms r
                           where r.id = messages.room_id
                             and auth.uid() in (r.buyer_id, r.seller_id)));
-- 읽음 처리 등 갱신은 방 참여자만
create policy messages_update on messages for update
  using (exists (select 1 from chat_rooms r
                  where r.id = messages.room_id
                    and auth.uid() in (r.buyer_id, r.seller_id)));

-- reviews : 조회 공개, 리뷰어 본인만 작성
create policy reviews_select on reviews for select using (true);
create policy reviews_insert on reviews for insert with check (auth.uid() = reviewer_id);

-- notifications : 본인 것만
create policy notifications_select on notifications for select using (auth.uid() = user_id);
create policy notifications_update on notifications for update using (auth.uid() = user_id);

-- blocks : 본인 것만
create policy blocks_select on blocks for select using (auth.uid() = blocker_id);
create policy blocks_insert on blocks for insert with check (auth.uid() = blocker_id);
create policy blocks_delete on blocks for delete using (auth.uid() = blocker_id);

-- reports : 생성만 허용(조회 불가 = 관리자 전용)
create policy reports_insert on reports for insert with check (auth.uid() = reporter_id);

-- recently_viewed : 본인 것만
create policy recently_viewed_select on recently_viewed for select using (auth.uid() = user_id);
create policy recently_viewed_write  on recently_viewed for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
