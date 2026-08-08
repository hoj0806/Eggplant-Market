-- =============================================================================
-- 카테고리 계층화 — 대분류 / 소분류 2단계
--
-- 0001에서 만든 categories는 평면 목록이었다. 당근마켓처럼 "디지털/가전 > 노트북"으로
-- 좁혀 고를 수 있어야 목록 필터도 의미가 생기므로 자기참조로 한 단계를 더 둔다.
--
-- 기존 12행은 그대로 대분류가 된다(parent_id is null). 데이터 이관은 없다.
-- 소분류 데이터 자체는 supabase/seed.sql 한 곳에서만 관리한다 —
-- 카테고리는 시드 고정값이라 스키마 변경과 값 변경을 섞지 않는 편이 낫다.
-- =============================================================================

alter table categories
  add column if not exists parent_id bigint references categories (id) on delete cascade;

-- 대분류 하나를 펼칠 때 자식을 정렬된 순서로 바로 읽는다.
create index if not exists categories_parent_idx on categories (parent_id, sort_order);

comment on column categories.parent_id is
  '상위 카테고리. null이면 대분류, 값이 있으면 그 대분류의 소분류다. posts.category_id에는 소분류를 넣는다.';
