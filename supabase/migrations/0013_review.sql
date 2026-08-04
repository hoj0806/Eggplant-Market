-- =============================================================================
-- 거래후기 · 매너온도
--
-- 0001에 이미 다 있다 — reviews 테이블, unique (post_id, reviewer_id),
-- 후기가 들어오면 매너온도를 더하고 알림까지 넣는 recalc_manner_temp 트리거.
-- 그런데도 전원이 36.5°에 멈춰 있는 이유는 **쓰는 화면이 없었기 때문**이다.
--
-- 화면을 붙이기 전에 이 파일이 먼저 하는 일은 "아무나 아무에게나 점수를 줄 수 있는" 구멍을
-- 막는 것이다. 0001의 reviews_insert는 `auth.uid() = reviewer_id` 하나뿐이라
--   · 거래한 적 없는 이웃에게 −점수를 꽂을 수 있고
--   · score 칸에 −99를 넣어 남의 매너온도를 한 번에 0으로 만들 수 있다.
-- 후기는 곧 남의 신뢰 점수라, 이 두 가지는 화면 규칙으로 둘 수 없다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 점수는 세 값 중 하나
--
-- 매너온도 가감치를 클라이언트가 자유롭게 정하게 두지 않는다. 아래 create_review가
-- 평가(good·normal·bad)를 받아 점수로 바꿔 주지만, RPC를 거치지 않고 테이블에 직접
-- insert하는 길이 여전히 열려 있으므로(reviews_insert) 마지막 방어선을 컬럼에 둔다.
--
-- 태그도 같은 이유로 길이를 제한한다. 내용까지 화이트리스트로 묶지는 않는다 —
-- comment가 어차피 자유 문구라 태그만 잠가 봐야 막는 것이 없다. 여기서 막는 것은 **분량**이다.
-- (check 제약에는 서브쿼리를 쓸 수 없어 원소별 길이 대신 이어 붙인 전체 길이를 본다)
-- -----------------------------------------------------------------------------
alter table reviews drop constraint if exists reviews_score_allowed;
alter table reviews add constraint reviews_score_allowed
  check (score in (-0.5, 0.1, 0.5));

alter table reviews drop constraint if exists reviews_manner_tags_bounded;
alter table reviews add constraint reviews_manner_tags_bounded
  check (
    coalesce(array_length(manner_tags, 1), 0) <= 5
    and char_length(array_to_string(manner_tags, ',')) <= 200
  );

alter table reviews drop constraint if exists reviews_comment_bounded;
alter table reviews add constraint reviews_comment_bounded
  check (comment is null or char_length(comment) <= 300);

comment on column reviews.score is
  '매너온도 가감치. good +0.5 · normal +0.1 · bad −0.5 셋 중 하나만 들어간다(reviews_score_allowed).';

-- -----------------------------------------------------------------------------
-- 2. 후기는 **끝난 거래의 상대에게만**
--
-- 조건이 네 겹이다.
--   ① 내가 쓰는 후기여야 한다                     auth.uid() = reviewer_id
--   ② 거래가 끝난 글이어야 한다                   status = 'sold'
--   ③ 그 거래의 두 당사자여야 한다                (판매자, 구매자) 짝이 맞아야 한다
--   ④ 방향이 서로를 향해야 한다                   내가 판매자면 상대는 구매자다
--
-- ③④는 posts를 봐야 판단할 수 있어 check 제약으로는 못 막는다(0008 posts_update와 같은 자리).
-- 한 거래에 한 번이라는 규칙은 0001의 unique (post_id, reviewer_id)가 이미 들고 있다.
--
-- 거래 상대를 고르지 않고 거래완료한 글(buyer_id is null)은 후기 대상이 아니다.
-- 상대를 고르는 일은 건너뛸 수 있으므로(tradePartnerPicker) 그런 글이 실제로 생긴다.
-- -----------------------------------------------------------------------------
drop policy if exists reviews_insert on reviews;
create policy reviews_insert on reviews
  for insert
  with check (
    auth.uid() = reviewer_id
    and reviewer_id <> reviewee_id
    and exists (
      select 1
        from posts p
       where p.id = reviews.post_id
         and p.status = 'sold'
         and p.buyer_id is not null
         and (
           (p.seller_id = reviews.reviewer_id and p.buyer_id  = reviews.reviewee_id)
           or
           (p.buyer_id  = reviews.reviewer_id and p.seller_id = reviews.reviewee_id)
         )
    )
  );

-- 수정·삭제 정책은 두지 않는다(0001부터 없다). 매너온도를 더하는 트리거가 insert에만 붙어 있어
-- 후기를 고치면 온도는 그대로고 문구만 바뀌는, 앞뒤가 맞지 않는 상태가 된다.

-- -----------------------------------------------------------------------------
-- 3. 후기 남기기
--
-- 클라이언트가 정하는 것은 평가·태그·한 줄뿐이다. **누구에게 주는 후기인지는 서버가 정한다** —
-- 게시물을 보고 내가 판매자면 구매자를, 구매자면 판매자를 상대로 삼는다.
-- reviewee_id를 받지 않으므로 "엉뚱한 사람에게 점수 주기"가 애초에 불가능하다
-- (record_recently_viewed가 user_id를 받지 않는 것과 같은 이유).
--
-- security definer가 아니다. 위 2번 정책이 그대로 걸려야 이 함수 밖의 경로도 같은 규칙을 탄다.
-- 정책이 막으면 42501이 오르는데, 그 전에 여기서 이유를 한국어로 구분해 던진다 —
-- "거래완료된 거래만", "이미 남겼다"는 사용자가 고칠 수 있는 것과 아닌 것이 다르다.
-- -----------------------------------------------------------------------------
create or replace function create_review(
  p_post_id     bigint,
  p_rating      text,
  p_manner_tags text[] default '{}',
  p_comment     text   default null
)
returns bigint
language plpgsql
as $$
declare
  v_user     uuid := auth.uid();
  v_seller   uuid;
  v_buyer    uuid;
  v_status   post_status;
  v_reviewee uuid;
  v_score    numeric(3, 1);
  v_id       bigint;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = 'insufficient_privilege';
  end if;

  case p_rating
    when 'good'   then v_score := 0.5;
    when 'normal' then v_score := 0.1;
    when 'bad'    then v_score := -0.5;
    else
      raise exception '알 수 없는 평가입니다: %', p_rating
        using errcode = 'invalid_parameter_value';
  end case;

  select p.seller_id, p.buyer_id, p.status
    into v_seller, v_buyer, v_status
    from posts p
   where p.id = p_post_id;

  if v_seller is null then
    raise exception '게시물을 찾을 수 없습니다.' using errcode = 'no_data_found';
  end if;

  if v_status <> 'sold' then
    raise exception '거래완료된 거래에만 후기를 남길 수 있습니다.' using errcode = 'check_violation';
  end if;

  if v_buyer is null then
    raise exception '거래 상대가 지정되지 않은 거래입니다.' using errcode = 'check_violation';
  end if;

  -- 상대를 서버가 정하는 자리. 당사자가 아니면 둘 중 어디에도 걸리지 않는다.
  if v_user = v_seller then
    v_reviewee := v_buyer;
  elsif v_user = v_buyer then
    v_reviewee := v_seller;
  else
    raise exception '이 거래의 당사자만 후기를 남길 수 있습니다.' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from reviews r where r.post_id = p_post_id and r.reviewer_id = v_user) then
    raise exception '이미 후기를 남긴 거래입니다.' using errcode = 'unique_violation';
  end if;

  insert into reviews (post_id, reviewer_id, reviewee_id, manner_tags, score, comment)
  values (
    p_post_id,
    v_user,
    v_reviewee,
    coalesce(p_manner_tags, '{}'),
    v_score,
    -- 빈 문자열은 "안 썼다"와 같다. null로 눕혀 화면이 한 가지만 보게 한다.
    nullif(btrim(coalesce(p_comment, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function create_review(bigint, text, text[], text) is
  '거래후기 작성. 평가(good·normal·bad)를 매너온도 가감치로 바꾸고, 후기 대상은 게시물의 반대편 당사자로 서버가 정한다.';

-- -----------------------------------------------------------------------------
-- 4. 받은 후기 목록 (프로필 화면)
--
-- 점수는 내려보내지 않는다. "+0.5를 받았다"는 화면에 적을 말이 아니고,
-- 온도는 이미 profiles.manner_temp에 녹아 있다. 대신 좋음·보통·나쁨만 문자열로 준다 —
-- 클라이언트가 score의 경계값을 알 이유가 없다.
--
-- 후기를 쓴 사람과 어떤 물건의 거래였는지는 함께 준다. 누가 썼는지 모르는 후기는
-- 근거가 되지 않는다. reviews_select·profiles_select·posts_select가 모두 공개라 그대로 읽힌다.
-- -----------------------------------------------------------------------------
create or replace function fetch_user_reviews(
  p_user_id   uuid,
  p_cursor_at timestamptz default null,
  p_cursor_id bigint      default null,
  p_limit     integer     default 20
)
returns table (
  id                  bigint,
  post_id             bigint,
  post_title          text,
  reviewer_id         uuid,
  reviewer_nickname   text,
  reviewer_avatar_url text,
  rating              text,
  manner_tags         text[],
  comment             text,
  created_at          timestamptz
)
language sql
stable
as $$
  select r.id, r.post_id, p.title,
         r.reviewer_id, w.nickname, w.avatar_url,
         case when r.score > 0.3 then 'good'
              when r.score < 0   then 'bad'
              else 'normal' end,
         r.manner_tags, r.comment, r.created_at
    from reviews r
    join profiles w on w.id = r.reviewer_id
    join posts    p on p.id = r.post_id
   where r.reviewee_id = p_user_id
     and (
       p_cursor_at is null
       or r.created_at < p_cursor_at
       or (r.created_at = p_cursor_at and r.id < coalesce(p_cursor_id, 0))
     )
   order by r.created_at desc, r.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function fetch_user_reviews(uuid, timestamptz, bigint, integer) is
  '사용자가 받은 거래후기 목록. 점수 대신 good·normal·bad만 주고 (created_at, id) keyset 페이징한다.';

-- -----------------------------------------------------------------------------
-- 5. 아직 후기를 안 남긴 내 거래
--
-- 구매내역·판매관리 목록에 "후기 남기기" 버튼을 붙이려면 카드마다 남길 수 있는지를 알아야 한다.
-- 0009의 네 RPC는 같은 열 벌을 돌려주기로 한 약속이 있어 여기에 컬럼을 더하지 않는다.
-- 대신 목록과 나란히 이 함수를 한 번 부르고, 화면은 post_id가 이 목록에 있는지만 본다.
--
-- 거래 상대가 없는 글(buyer_id is null)은 애초에 여기 오지 않는다 — 버튼을 눌렀는데
-- 서버가 거절하는 자리를 만들지 않기 위해서다.
-- -----------------------------------------------------------------------------
create or replace function fetch_pending_reviews(p_limit integer default 50)
returns table (
  post_id            bigint,
  post_title         text,
  post_thumbnail_url text,
  partner_id         uuid,
  partner_nickname   text,
  sold_at            timestamptz
)
language sql
stable
as $$
  select p.id, p.title, p.thumbnail_url,
         partner.id, partner.nickname,
         coalesce(p.sold_at, p.updated_at)
    from posts p
    join profiles partner
      on partner.id = case when p.seller_id = auth.uid() then p.buyer_id else p.seller_id end
   where p.status = 'sold'
     and p.buyer_id is not null
     and auth.uid() in (p.seller_id, p.buyer_id)
     and not exists (
       select 1 from reviews r
        where r.post_id = p.id and r.reviewer_id = auth.uid()
     )
   order by coalesce(p.sold_at, p.updated_at) desc, p.id desc
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

comment on function fetch_pending_reviews(integer) is
  '내가 아직 후기를 남기지 않은 거래완료 건. 구매·판매 양쪽을 함께 준다.';

-- -----------------------------------------------------------------------------
-- 6. 인덱스
--
-- 0001의 reviews_reviewee_idx(reviewee_id)는 4번의 정렬 키를 덮지 못한다.
-- (reviewee_id, created_at desc, id desc)가 앞부분을 그대로 품으므로 옛 인덱스는 지운다
-- (0011이 posts_region_price_idx를 지운 것과 같은 판단).
--
-- 5번의 not exists는 0001의 unique (post_id, reviewer_id)가 그대로 받는다.
-- -----------------------------------------------------------------------------
create index if not exists reviews_reviewee_keyset_idx
  on reviews (reviewee_id, created_at desc, id desc);

drop index if exists reviews_reviewee_idx;
