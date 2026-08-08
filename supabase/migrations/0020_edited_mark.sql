-- =============================================================================
-- 0020_edited_mark.sql — "수정됨" 표시 · 댓글 수정
--
-- `backlog.md` §4가 둘을 **한 묶음**으로 묶어 둔 이유가 있다. 댓글을 고칠 수 있게 하려면
-- "수정됨"이 따라와야 하는데 게시물이 아직 그것을 안 하고 있었고, 게시물 쪽을 손대 보니
-- 표시를 붙이기 전에 **`updated_at`의 뜻부터 정리해야** 했다.
--
-- 이 파일이 하는 일은 셋이다.
--   1. posts.updated_at을 "내용을 고친 시각"으로 좁힌다 (0008의 판단을 뒤집는다)
--   2. comments.updated_at을 만든다
--   3. 댓글 update가 content 말고는 못 바꾸게 막는다 (0001의 정책이 비워 둔 자리)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. posts.updated_at — 제외 목록을 뒤집어 포함 목록으로
--
-- 0005가 조회수·찜을, 0010이 끌올을 제외 조건에 넣었다. 둘 다 옳았지만 **제외 목록 방식**이라
-- 새로 생기는 칸은 자동으로 "수정"이 된다. 실제로 0008이 그 길로 하나를 들여놨다.
--
--   -- 0008: 상태 변경은 "수정"이 아니라고 볼 여지도 있으나, 판매자가 의도적으로 누른
--   --       변경이므로 updated_at은 그대로 따라 오르게 둔다
--
-- 그때는 맞는 판단이었다. `updated_at`을 **읽는 화면이 없었으므로** 그 값은 "이 행이 마지막으로
-- 바뀐 때"라는 뜻이었고, 상태 변경은 분명히 행을 바꾼다.
--
-- 지금은 이 값이 화면에 "수정됨" 세 글자로 나온다. 뜻이 달라졌다 —
-- **판매자가 예약중으로 바꿨을 뿐인데 "수정됨"이 뜨면 읽는 사람은 글·가격이 바뀐 줄 안다.**
-- 상태는 이미 배지로 따로 보이고 있어서 두 번 말할 이유도 없다.
--
-- 그래서 제외 목록을 버리고 **포함 목록**으로 뒤집는다. `postApi.updatePost`가 실제로 쓰는
-- 칸들이다. 이렇게 두면 앞으로 칸이 늘어도 기본값이 "수정이 아님"이 되고, 수정으로 치려면
-- 여기 이름을 적어야 한다 — 0005·0010·0008이 되풀이한 자리를 닫는다.
--
-- 동네(region_code·dong_name·location)는 넣지 않았다. 수정 화면이 건드리지 않기 때문이다
-- (2단계에서 "올린 뒤 이사를 갔더라도 그 글이 그 동네 글이었다는 사실은 그대로"로 정했다).
--
-- 상태·끌올·조회수·찜과 내용을 **한 문장으로 함께** 바꾸면 수정으로 친다. 제외 목록이었다면
-- 그 반대였다 — 상태를 끼워 넣는 것만으로 수정 표시를 지울 수 있었다.
-- -----------------------------------------------------------------------------
drop trigger if exists posts_set_updated_at on posts;
create trigger posts_set_updated_at
  before update on posts
  for each row when (
    old.title               is distinct from new.title
    or old.description      is distinct from new.description
    or old.price            is distinct from new.price
    or old.category_id      is distinct from new.category_id
    or old.thumbnail_url    is distinct from new.thumbnail_url
    or old.trade_location_text is distinct from new.trade_location_text
    or old.trade_location   is distinct from new.trade_location
  )
  execute function set_updated_at();

comment on column posts.updated_at is
  '판매자가 글의 내용을 고친 시각. 상태 변경·끌올·조회수·찜은 올리지 않는다(0020). 만든 뒤 안 고쳤으면 created_at과 같다.';

-- **이미 쌓인 값은 되돌리지 않는다.** 지금 `updated_at > created_at`인 행이 내용 수정이었는지
-- 상태 변경이었는지 되짚을 방법이 없다(그 구분을 남긴 곳이 없다). 앞으로 쌓이는 값부터 정확하다.

-- -----------------------------------------------------------------------------
-- 2. comments.updated_at
--
-- 0001의 comments에는 created_at만 있다. 고칠 화면이 없었으니 필요도 없었다.
--
-- **default를 그대로 두면 기존 댓글이 전부 "방금 수정됨"이 된다.** `add column ... default now()`는
-- 이미 있는 행도 그 값으로 채우기 때문이다. 그래서 곧바로 created_at으로 맞춰 준다 —
-- 지금 이 저장소의 댓글은 0건이지만, 이 파일이 다른 환경에서도 같게 돌아야 한다.
--
-- null로 두고 "수정된 적 있으면 값이 있다"로 만들 수도 있었다. profiles·posts가 이미
-- `not null default now()` + 트리거 모양이라 같은 결로 맞췄다 — 읽는 쪽이 한 가지 규칙만
-- 알면 된다("created_at보다 크면 고쳐진 것").
--
-- 트리거는 **내용이 실제로 달라졌을 때만** 돈다. 고치기 화면에서 아무것도 안 바꾸고 저장을
-- 눌러도 "수정됨"이 붙지 않는다.
-- -----------------------------------------------------------------------------
alter table comments add column if not exists updated_at timestamptz not null default now();

update comments set updated_at = created_at where updated_at is distinct from created_at;

comment on column comments.updated_at is
  '댓글을 고친 시각. 내용이 실제로 달라질 때만 오른다(0020). 안 고쳤으면 created_at과 같다.';

drop trigger if exists comments_set_updated_at on comments;
create trigger comments_set_updated_at
  before update on comments
  for each row when (old.content is distinct from new.content)
  execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. 댓글 update는 내용만
--
-- 0017이 이렇게 적어 두었다 — "수정 정책(comments_update)은 0001 그대로 둔다. (…)
-- 정책만 남아 있는 것은 위험하지 않다. 작성자 본인만 통과한다."
--
-- 본인만 통과하는 것은 맞다. update는 `with check`를 안 쓰면 `using`이 새 행에도 걸리므로
-- author_id를 남의 것으로 바꿔 넣을 수도 없다. 그런데 **본인이 자기 댓글로 할 수 있는 일**이
-- 열려 있었다.
--
--   post_id   : 다른 글로 옮긴다 — 엉뚱한 글에 내 댓글이 나타난다
--   parent_id : 아무 댓글 밑으로 옮겨 붙인다 (대댓글이 생기면서 실제로 뜻이 생긴 칸이다)
--   created_at: 시간을 바꿔 목록 맨 위로 올린다
--
-- 화면이 보내는 것은 content 하나뿐이라 잃는 것이 없다. `guard_message_update`(0008)·
-- `guard_notification_update`(0015)와 같은 자리, 같은 모양이다.
--
-- 트리거 이름을 `comments_guard_update`로 둔 것은 우연이 아니다. before 트리거는 이름순으로
-- 도므로 `comments_guard_update`가 `comments_set_updated_at`보다 먼저 돈다 —
-- 막을 것을 먼저 막고 시각을 찍는다.
-- -----------------------------------------------------------------------------
create or replace function guard_comment_update()
returns trigger
language plpgsql
as $$
begin
  if new.post_id    is distinct from old.post_id
  or new.author_id  is distinct from old.author_id
  or new.parent_id  is distinct from old.parent_id
  or new.created_at is distinct from old.created_at then
    raise exception '댓글은 내용만 수정할 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function guard_comment_update is
  '댓글 update에서 content 외의 컬럼 변경을 막는다. 글·부모·작성 시각이 사후에 바뀌지 않게 하는 자리.';

drop trigger if exists comments_guard_update on comments;
create trigger comments_guard_update
  before update on comments
  for each row execute function guard_comment_update();
