-- =============================================================================
-- 시드 데이터 — 카테고리 (당근마켓 기준 대표 분류)
-- 로컬: `supabase db reset` 시 자동 적용
--
-- 대분류(parent_id is null) → 소분류 2단계다. 게시물은 소분류에 붙인다.
-- 모든 문장이 `on conflict (slug) do nothing`이라 몇 번을 다시 실행해도 안전하다.
-- =============================================================================

-- 대분류 ----------------------------------------------------------------------
insert into categories (name, slug, sort_order) values
  ('디지털/가전',   'digital',     10),
  ('가구/인테리어', 'furniture',   20),
  ('생활/주방',     'life',        30),
  ('유아동',        'kids',        40),
  ('의류',          'clothing',    50),
  ('뷰티/미용',     'beauty',      60),
  ('스포츠/레저',   'sports',      70),
  ('취미/게임/음반','hobby',       80),
  ('도서',          'books',       90),
  ('반려동물용품',  'pet',        100),
  ('식물',          'plant',      110),
  ('기타 중고물품', 'etc',        120)
on conflict (slug) do nothing;

-- 소분류 ----------------------------------------------------------------------
-- slug는 `{대분류slug}-{항목}` 규칙이다. slug의 전역 unique 제약을 지키면서
-- 값만 보고도 어느 대분류 소속인지 알 수 있다.
-- 부모 id는 하드코딩하지 않고 slug로 찾는다 — identity 컬럼이라 환경마다 id가 다를 수 있다.
insert into categories (name, slug, sort_order, parent_id)
select v.name, v.slug, v.sort_order, parent.id
  from (values
    -- 디지털/가전
    ('휴대폰',            'digital-phone',      10, 'digital'),
    ('태블릿/PC',         'digital-tablet',     20, 'digital'),
    ('노트북',            'digital-laptop',     30, 'digital'),
    ('카메라',            'digital-camera',     40, 'digital'),
    ('게임기',            'digital-console',    50, 'digital'),
    ('음향기기',          'digital-audio',      60, 'digital'),
    ('생활가전',          'digital-appliance',  70, 'digital'),
    ('주방가전',          'digital-kitchen',    80, 'digital'),
    ('기타 디지털/가전',  'digital-etc',        90, 'digital'),

    -- 가구/인테리어
    ('침실가구',          'furniture-bedroom',  10, 'furniture'),
    ('거실가구',          'furniture-living',   20, 'furniture'),
    ('주방가구',          'furniture-kitchen',  30, 'furniture'),
    ('수납가구',          'furniture-storage',  40, 'furniture'),
    ('조명',              'furniture-lighting', 50, 'furniture'),
    ('침구/커튼',         'furniture-bedding',  60, 'furniture'),
    ('인테리어소품',      'furniture-decor',    70, 'furniture'),

    -- 생활/주방
    ('주방용품',          'life-kitchenware',   10, 'life'),
    ('생활용품',          'life-daily',         20, 'life'),
    ('욕실용품',          'life-bath',          30, 'life'),
    ('청소/세탁',         'life-cleaning',      40, 'life'),
    ('공구/철물',         'life-tools',         50, 'life'),
    ('문구/사무용품',     'life-stationery',    60, 'life'),

    -- 유아동
    ('유아의류',          'kids-clothing',      10, 'kids'),
    ('유아신발',          'kids-shoes',         20, 'kids'),
    ('유모차/카시트',     'kids-stroller',      30, 'kids'),
    ('장난감',            'kids-toy',           40, 'kids'),
    ('유아가구',          'kids-furniture',     50, 'kids'),
    ('수유/이유용품',     'kids-feeding',       60, 'kids'),
    ('유아도서',          'kids-books',         70, 'kids'),

    -- 의류
    ('여성의류',          'clothing-women',     10, 'clothing'),
    ('남성의류',          'clothing-men',       20, 'clothing'),
    ('신발',              'clothing-shoes',     30, 'clothing'),
    ('가방/지갑',         'clothing-bag',       40, 'clothing'),
    ('시계/주얼리',       'clothing-jewelry',   50, 'clothing'),
    ('패션잡화',          'clothing-accessory', 60, 'clothing'),

    -- 뷰티/미용
    ('스킨케어',          'beauty-skincare',    10, 'beauty'),
    ('메이크업',          'beauty-makeup',      20, 'beauty'),
    ('헤어/바디',         'beauty-hairbody',    30, 'beauty'),
    ('향수',              'beauty-perfume',     40, 'beauty'),
    ('미용기기',          'beauty-device',      50, 'beauty'),

    -- 스포츠/레저
    ('자전거',            'sports-bike',        10, 'sports'),
    ('등산/캠핑',         'sports-camping',     20, 'sports'),
    ('골프',              'sports-golf',        30, 'sports'),
    ('헬스/요가',         'sports-fitness',     40, 'sports'),
    ('구기스포츠',        'sports-ball',        50, 'sports'),
    ('수영/수상레저',     'sports-water',       60, 'sports'),
    ('낚시',              'sports-fishing',     70, 'sports'),

    -- 취미/게임/음반
    ('음반/DVD',          'hobby-music',        10, 'hobby'),
    ('악기',              'hobby-instrument',   20, 'hobby'),
    ('게임/타이틀',       'hobby-game',         30, 'hobby'),
    ('피규어/프라모델',   'hobby-figure',       40, 'hobby'),
    ('보드게임',          'hobby-boardgame',    50, 'hobby'),
    ('아트/공예',         'hobby-craft',        60, 'hobby'),
    ('수집품',            'hobby-collection',   70, 'hobby'),

    -- 도서
    ('소설/에세이',       'books-novel',        10, 'books'),
    ('자기계발',          'books-selfhelp',     20, 'books'),
    ('인문/사회',         'books-humanities',   30, 'books'),
    ('수험서/문제집',     'books-exam',         40, 'books'),
    ('잡지',              'books-magazine',     50, 'books'),
    ('만화책',            'books-comic',        60, 'books'),
    ('어린이도서',        'books-children',     70, 'books'),

    -- 반려동물용품
    ('강아지용품',        'pet-dog',            10, 'pet'),
    ('고양이용품',        'pet-cat',            20, 'pet'),
    ('관상어/파충류',     'pet-aquarium',       30, 'pet'),
    ('사료/간식',         'pet-food',           40, 'pet'),
    ('기타 반려용품',     'pet-etc',            50, 'pet'),

    -- 식물
    ('실내식물',          'plant-indoor',       10, 'plant'),
    ('다육/선인장',       'plant-succulent',    20, 'plant'),
    ('화분/원예용품',     'plant-supplies',     30, 'plant'),
    ('씨앗/모종',         'plant-seed',         40, 'plant'),

    -- 기타 중고물품
    ('티켓/쿠폰',         'etc-ticket',         10, 'etc'),
    ('삽니다',            'etc-wanted',         20, 'etc'),
    ('기타',              'etc-etc',            30, 'etc')
  ) as v (name, slug, sort_order, parent_slug)
  join categories parent on parent.slug = v.parent_slug
on conflict (slug) do nothing;
