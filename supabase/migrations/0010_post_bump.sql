-- =============================================================================
-- 끌어올리기(bump)
--
-- posts.bumped_at은 0001부터 있었고 홈·검색·판매관리가 전부 이 컬럼으로 정렬한다.
-- 그런데 값을 올리는 길이 없어 지금까지는 사실상 created_at의 복사본이었다.
--
-- 이 파일이 하는 일은 둘이다.
--   1. bumped_at을 올리는 유일한 통로(bump_post)를 만들고 그 규칙을 서버에 못 박는다
--   2. 끌올이 updated_at을 건드리지 않게 막는다
--
-- 규칙을 클라이언트에 두지 않는 이유는 0008의 상태 전이 트리거와 같다. 24시간 쿨다운은
-- "누르면 목록 맨 위로 간다"는 보상이 걸린 규칙이라, 화면에서만 막으면 요청을 직접 보내는
-- 것만으로 뚫린다. 판매중 조건도 마찬가지다 — 거래완료된 글이 홈 맨 위에 있으면 안 된다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 끌올은 updated_at을 올리지 않는다
--
-- 0005가 조회수·찜을 제외 조건에 넣은 것과 같은 이유다. updated_at은 "판매자가 글의 내용을
-- 고친 시각"이어야 하고, 끌올은 내용을 바꾸지 않는다. 여기서 빼두지 않으면 2-1의 수정 기능이
-- 붙는 순간 "3일 전에 올린 글을 방금 수정함"으로 보이게 된다.
-- (상태 변경은 0008이 판단한 대로 수정으로 본다 — 그대로 둔다.)
-- -----------------------------------------------------------------------------
drop trigger if exists posts_set_updated_at on posts;
create trigger posts_set_updated_at
  before update on posts
  for each row when (
    old.view_count is not distinct from new.view_count
    and old.like_count is not distinct from new.like_count
    and old.bumped_at is not distinct from new.bumped_at
  )
  execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. 끌어올리기
--
-- security definer를 쓰지 않는다. 끌올은 자기 글에만 하는 일이라 호출자 권한으로 충분하고
-- (posts_update가 `auth.uid() = seller_id`), definer로 만들면 그 정책이 비켜 가버린다.
-- 조회수(increment_view_count)가 definer여야 했던 것은 남의 글을 고쳐야 했기 때문이다.
--
-- 거절 사유를 문구로 구분해 돌려준다. 남은 시간을 화면에 적으려면 클라이언트가
-- "쿨다운이라 막혔다"와 "판매중이 아니라 막혔다"를 구분할 수 있어야 한다.
--
-- 반환값은 갱신된 bumped_at이다. 클라이언트가 곧바로 다음 끌올 가능 시각을 계산한다.
-- -----------------------------------------------------------------------------
create or replace function bump_post(p_post_id bigint)
returns timestamptz
language plpgsql
as $$
declare
  v_seller_id uuid;
  v_status    post_status;
  v_bumped_at timestamptz;
begin
  select seller_id, status, bumped_at
    into v_seller_id, v_status, v_bumped_at
    from posts
   where id = p_post_id;

  if not found then
    raise exception '게시물을 찾을 수 없습니다.'
      using errcode = 'no_data_found';
  end if;

  if v_seller_id is distinct from auth.uid() then
    raise exception '내가 올린 글만 끌어올릴 수 있습니다.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_status <> 'selling' then
    raise exception '판매중인 글만 끌어올릴 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  -- 마지막 끌올(한 번도 안 했으면 등록 시각)로부터 24시간.
  if v_bumped_at > now() - interval '24 hours' then
    raise exception '끌어올리기는 24시간에 한 번만 할 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  update posts
     set bumped_at = now()
   where id = p_post_id
  returning bumped_at into v_bumped_at;

  return v_bumped_at;
end;
$$;

comment on function bump_post is
  '게시물 끌어올리기. 판매자 본인 + 판매중 + 마지막 끌올로부터 24시간 경과일 때만 bumped_at을 now()로 올린다. 갱신된 bumped_at을 돌려준다.';
