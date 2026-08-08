-- =============================================================================
-- 동네 설정 — 최초 가입 시 자신의 동네를 정하고, 이후 변경할 수 있게 한다.
--
-- 표시 단위는 당근마켓과 동일하게 시/구/동. 예: "서울특별시 강북구 수유동"
-- 기준은 **법정동(카카오 region_type = 'B', b_code)** 이다.
--   - 행정동(H)은 "수유1동"처럼 숫자가 붙어 사용자가 검색·인지하는 이름과 어긋난다.
--   - 카카오 주소검색(addressSearch)이 돌려주는 것도 법정동 코드라, GPS 경로와 검색 경로를
--     모두 B로 맞춰야 "고른 이름"과 "저장된 이름"이 달라지지 않는다.
--
-- 좌표 자체(profiles.location geography)와 검색 반경(search_radius_m)은 0001에서 이미 만들었다.
-- =============================================================================

alter table profiles
  add column if not exists region_code   text,   -- 법정동 코드 10자리
  add column if not exists region_depth1 text,   -- 시/도
  add column if not exists region_depth2 text,   -- 시군구
  add column if not exists region_depth3 text;   -- 읍면동

-- PostgREST는 geography를 EWKB hex 문자열로 돌려주므로 클라이언트가 그대로 읽을 수 없다.
-- geography→geometry 캐스트와 st_x/st_y가 모두 IMMUTABLE이라 stored 생성 컬럼으로 좌표를 노출한다.
-- (쓰기는 location 한 곳에만 하고, 이 두 컬럼은 항상 파생값이라 어긋날 수 없다.)
alter table profiles
  add column if not exists location_lat double precision
    generated always as (st_y(location::geometry)) stored,
  add column if not exists location_lng double precision
    generated always as (st_x(location::geometry)) stored;

-- 같은 동네 이웃 조회에 쓸 인덱스.
create index if not exists profiles_region_code_idx on profiles (region_code);

comment on column profiles.region_code   is '법정동 코드(카카오 b_code) 10자리. 같은 동네 판별 기준.';
comment on column profiles.region_depth1 is '시/도. 예: "서울특별시"';
comment on column profiles.region_depth2 is '시군구. 예: "강북구"';
comment on column profiles.region_depth3 is '읍면동. 예: "수유동"';
comment on column profiles.dong_name     is '표시용 전체 주소. region_depth1~3을 공백으로 이은 값. 예: "서울특별시 강북구 수유동"';
comment on column profiles.location_lat  is 'location의 위도(파생 컬럼, 쓰기 금지).';
comment on column profiles.location_lng  is 'location의 경도(파생 컬럼, 쓰기 금지).';

-- 주의: 기존 사용자 데이터는 손대지 않는다.
-- 이 기능 이전에 가입한 행은 onboarded_at은 차 있으나 dong_name이 null인데,
-- 앱의 isOnboardingComplete(onboarded_at != null && region != null) 판정이
-- 이들을 온보딩 동네 단계로 자연스럽게 유도한다.
