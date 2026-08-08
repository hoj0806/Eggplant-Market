-- =============================================================================
-- 0033_secret_comment.sql — 비밀 댓글
--
-- `backlog.md` §5-9. 판매자와 작성자만 보는 댓글이다. 거기 적어 둔 문장이 이 파일의 전부다 —
-- "정책 한 줄이 아니라 **누구에게 보이는가가 하나 더 생기는 일**이다."
--
-- 지금까지 `comments_select`가 보던 것은 차단 하나뿐이었다(0017). 차단은 **사람**을 보는
-- 조건이라 행마다 같은 답이 나오지만, 공개 범위는 **행마다** 다르다. 축이 하나 늘어난다.
--
-- -----------------------------------------------------------------------------
-- 정한 것 셋
--
--   ① 누가 보는가      : 게시물 판매자 + 그 댓글을 쓴 사람. 둘뿐이다.
--   ② 답글은 어떻게    : **부모를 따라간다.** 답글이 따로 고를 수 없다(아래 2번).
--   ③ 남에게는 어떻게  : **완전히 감춘다.** "비밀 댓글입니다" 자리도 남기지 않는다.
--                        따라서 카드의 "댓글 n"도 공개 댓글만 센다(아래 5번).
--
-- ②를 "각자 고른다"로 열면 비밀 댓글 밑에 공개 답글이 달릴 수 있다. 그 답글은 부모가
-- 안 보이는 사람에게도 보이는데, 답이란 물음을 되풀이하기 마련이라 **가린 내용이 답글로
-- 새어 나간다.** 화면에서도 부모 없는 답글 한 줄이 1단으로 떠오른다(`buildCommentTree`).
--
-- ③을 "자리는 남긴다"로 열면(당근이 그렇게 한다) 내용은 못 보여도 있다는 사실은 알린다.
-- 그러면 RLS로는 부족하다 — **RLS는 행 단위라 "행은 주되 내용만 가린다"를 못 한다.**
-- 목록 RPC나 뷰를 하나 더 세워 content만 비워 내려보내야 하고, 그 순간 0017이
-- "댓글은 임베드로 읽는다"고 정한 자리가 통째로 바뀐다. 감추는 쪽은 정책 하나로 끝난다.
--
-- -----------------------------------------------------------------------------
-- 여기서 걸린 것 — 정책이 자기 테이블을 다시 읽을 수 없다
--
-- ②를 지키려면 답글을 볼 때 **부모 댓글의 작성자**를 알아야 한다. 비밀 댓글에 판매자가
-- 답하면 그 답글의 author_id는 판매자이고, 물어본 사람은 거기 없다 — 부모를 봐야 나온다.
--
-- 그런데 `comments_select` 안에서 `comments`를 다시 읽으면 그 서브쿼리에도 같은 정책이
-- 걸려 **infinite recursion detected in policy for relation "comments"**로 죽는다.
-- 0014가 `blocks`에서 겪은 것과 같은 모양이라 답도 같다 — `private`의 security definer
-- 함수로 뺀다(아래 2번). 그쪽에서는 RLS가 꺼지므로 부모를 언제나 읽을 수 있다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 칸
--
-- `not null default false`다. 이미 달린 댓글은 전부 공개였고 앞으로도 기본은 공개다 —
-- 비밀은 쓰는 사람이 매번 고르는 값이지 빠뜨리면 되는 값이 아니다.
-- (0020이 `updated_at`을 더할 때 겪은 "default가 기존 행까지 채운다"는 여기서는 오히려
--  맞는 동작이다. false로 채워지는 것이 사실 그대로다.)
-- -----------------------------------------------------------------------------
alter table comments add column if not exists is_secret boolean not null default false;

comment on column comments.is_secret is
  '비밀 댓글인가. 참이면 게시물 판매자와 이 실타래를 연 사람만 읽는다(0033). 답글은 부모 값을 그대로 물려받는다.';

-- 비밀 댓글은 전체의 일부다. 정책이 `is_secret`으로 갈라지므로 부분 인덱스를 둘 만하지만
-- **두지 않는다** — 한 글의 댓글은 통째로 읽고(페이징이 없다) 0017의
-- `comments_post_created_idx`가 이미 그 범위를 좁힌다. 그 안에서 몇 줄을 더 보는 일이다.

-- -----------------------------------------------------------------------------
-- 2. 이 실타래를 연 사람
--
-- 1단 댓글이면 자기 자신, 답글이면 부모 댓글의 작성자다. **깊이가 2로 고정**이라
-- (`buildCommentTree`가 그 이유를 적어 두었다 — 0018의 알림이 부모 한 사람에게만 간다)
-- 부모는 언제나 1단이고, 그래서 재귀 CTE 없이 한 번만 올라가면 끝난다.
--
-- 3단이 열리는 날 이 함수도 함께 열어야 한다. 그때는 루트까지 거슬러 올라가야 하는데,
-- 애초에 3단은 알림 때문에 열지 않기로 했다(backlog.md §4).
--
-- `private`에 두는 이유는 0014·0031과 같다. PostgREST는 public 스키마만 라우팅하므로
-- 클라이언트가 `rpc()`로 부를 수 없다 — **부를 수 있으면 남의 비밀 댓글 작성자를
-- id 하나씩 넣어 보며 알아낼 수 있다.**
--
-- `security definer`가 핵심이다. 머리말에 적은 재귀를 이것이 끊는다.
-- 노출이 늘지 않는 이유는 돌려주는 값이 **인자로 넘긴 댓글의 부모 작성자 하나**뿐이고,
-- 그 값을 쓰는 곳이 "그게 나인가"만 묻는 정책 한 군데이기 때문이다.
-- -----------------------------------------------------------------------------
create or replace function private.comment_thread_author(p_parent_id bigint, p_author_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.author_id from comments c where c.id = p_parent_id),
    p_author_id
  );
$$;

comment on function private.comment_thread_author(bigint, uuid) is
  '이 댓글이 속한 실타래를 연 사람. 1단이면 자기 자신, 답글이면 부모 댓글의 작성자다. 비밀 댓글의 공개 범위가 이 사람이다(0033).';

grant execute on function private.comment_thread_author(bigint, uuid)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. 읽기 — 축이 하나 늘어난다
--
-- 0017의 차단 조건은 **그대로 두고** 괄호로 묶어 `and`로 잇는다. 둘은 서로 독립이다 —
-- 차단한 사람의 비밀 댓글은 두 조건 모두에서 막히고, 그 사실이 어느 쪽에서 막혔는지는
-- 물을 필요가 없다.
--
-- 안쪽 네 갈래는 순서가 곧 비용 순이다.
--
--   not is_secret            : 대부분의 댓글이 여기서 끝난다. 칸 하나만 본다.
--   auth.uid() = author_id   : 내 댓글. 칸 둘.
--   comment_thread_author    : 함수 한 번(위 2번). 비밀 댓글에서만 불린다.
--   posts 조회               : 게시물 판매자인가. 인덱스 조회 한 번.
--
-- **`auth.uid() = author_id`는 사실 없어도 된다.** 비밀 댓글에 답글을 달 수 있는 사람은
-- 그 댓글을 볼 수 있는 사람뿐이고, 그 둘은 판매자와 실타래 주인이라 아래 두 갈래가
-- 이미 덮는다. 그래도 남긴다 — **"내가 쓴 글은 언제나 나에게 보인다"가 다른 조건의
-- 부수 효과로만 참이면, 그 조건이 바뀌는 날 조용히 거짓이 된다.**
--
-- 비로그인은 `auth.uid()`가 null이라 뒤 세 갈래가 전부 null이 되고, `not is_secret`만
-- 남는다. 공개 댓글만 보인다 — 맞는 동작이다.
--
-- 판매자 확인을 `posts`에서 하는 것은 0017의 `comments_delete`와 같은 모양이다.
-- `posts_select`가 `using (true)`라 여기서는 재귀가 없다.
-- -----------------------------------------------------------------------------
drop policy if exists comments_select on comments;
create policy comments_select on comments
  for select
  using (
    author_id <> all (private.blocked_user_ids())
    and (
      not is_secret
      or auth.uid() = author_id
      or auth.uid() = private.comment_thread_author(parent_id, author_id)
      or exists (
        select 1
          from posts p
         where p.id = comments.post_id
           and p.seller_id = auth.uid()
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 4. 쓰기 — 답글은 고르지 않는다
--
-- 정책이 아니라 트리거다. 정책은 막을 수만 있고 **고쳐 넣을 수는 없다.**
-- 막는 쪽으로 만들면 화면이 부모의 `is_secret`을 정확히 실어 보내야 하고, 틀리면
-- 답글이 통째로 거절된다 — 규칙을 아는 곳이 서버와 화면 둘이 된다.
--
-- 그래서 **받아 적는다.** 화면이 무엇을 보내든 답글의 공개 범위는 부모와 같아진다.
-- 규칙이 한 군데(여기)에만 있고, 화면은 몰라도 틀릴 수가 없다.
--
-- 조용히 값을 바꾸는 것이 위험한 방향인지 따져 봤다. 두 가지뿐이다.
--
--   공개 부모 + 비밀 답글 요청 → 공개가 된다. 새어 나갈 비밀이 애초에 없다
--                                (부모가 이미 모두에게 보인다).
--   비밀 부모 + 공개 답글 요청 → 비밀이 된다. 감추는 쪽으로 틀린다.
--
-- 위험한 쪽으로는 틀릴 수 없다. `guard_message_update`(0008)처럼 거절로 가지 않은 이유다.
--
-- 부모를 못 찾으면 그대로 둔다. 곧이어 FK가 거절하므로(0001의 `parent_id`) 여기서
-- 한 번 더 볼 것이 없다.
--
-- `security definer`인 이유는 2번과 같다. 남의 비밀 댓글에 답글을 다는 일은 **정상 동작**이고
-- (판매자가 답한다) 그때 부모는 트리거를 부른 사람에게 보이지만, 안 보이는 부모를 가리켰을 때
-- invoker면 조회가 비어 **공개 답글이 되어 버린다.** definer면 언제나 진짜 부모를 읽는다.
-- -----------------------------------------------------------------------------
create or replace function inherit_comment_secret()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.parent_id is not null then
    new.is_secret := coalesce(
      (select c.is_secret from comments c where c.id = new.parent_id),
      new.is_secret
    );
  end if;

  return new;
end;
$$;

comment on function inherit_comment_secret is
  '답글의 공개 범위를 부모 댓글에서 물려받는다. 비밀 댓글 밑에 공개 답글이 달려 내용이 새는 것을 막는 자리(0033).';

drop trigger if exists comments_inherit_secret on comments;
create trigger comments_inherit_secret
  before insert on comments
  for each row execute function inherit_comment_secret();

-- 고치기에서도 잠근다. 0020이 `post_id`·`parent_id`·`created_at`을 잠근 그 자리에 하나 더다.
--
-- 열어 두면 **이미 답을 받은 뒤에 공개로 돌릴 수 있다.** 판매자가 비밀인 줄 알고 적은
-- 가격이 나중에 모두에게 보이게 되는데, 그 답글은 판매자의 글이지 여는 사람의 글이 아니다.
-- 0027이 제안에, 0008이 대화 기록에 그은 선과 같다 — **사후에 뜻이 바뀌지 않는다.**
--
-- 반대 방향(공개 → 비밀)도 함께 막힌다. 이미 남들이 읽은 글이라 감춰도 되돌릴 것이 없고,
-- 무엇보다 5번의 집계가 그 순간 어긋난다(insert에서 안 센 것을 delete에서 빼게 된다).
create or replace function guard_comment_update()
returns trigger
language plpgsql
as $$
begin
  if new.post_id    is distinct from old.post_id
  or new.author_id  is distinct from old.author_id
  or new.parent_id  is distinct from old.parent_id
  or new.is_secret  is distinct from old.is_secret
  or new.created_at is distinct from old.created_at then
    raise exception '댓글은 내용만 수정할 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function guard_comment_update is
  '댓글 update에서 content 외의 컬럼 변경을 막는다. 글·부모·공개 범위·작성 시각이 사후에 바뀌지 않게 하는 자리.';

-- -----------------------------------------------------------------------------
-- 5. 카드의 "댓글 n"은 공개 댓글만 센다
--
-- 0028의 `comment_count`는 `posts`의 **평범한 컬럼**이라 RLS가 걸리지 않는다.
-- 보는 사람이 누구든 같은 값 하나가 나간다. 그러니 그 하나를 무엇으로 채울지가 문제다.
--
-- 전부 세면 못 보는 사람에게 "댓글 2"라고 적어 놓고 상세에서는 한 줄만 보여 주게 된다.
-- 숫자가 틀린 것도 문제지만 더 나쁜 것은 그 차이가 **"여기 비밀 댓글이 있다"는 신호**라는
-- 점이다. 감추기로 한 사실(머리말 ③)이 숫자 하나로 새어 나간다.
--
-- 공개 댓글만 세면 판매자·작성자에게는 카드가 실제보다 적게 적힌다. 이쪽도 어긋나지만
-- **"더 있다"를 안 알릴 뿐 없는 것을 지어내지 않는다.** 카드의 숫자가 보는 사람마다
-- 달라질 수 없는 이상, 기준은 가장 적게 보는 사람이어야 한다.
--
-- 상세 화면의 "댓글 n"은 이 컬럼이 아니라 **받아 온 목록의 길이**다(`commentSection`).
-- 그쪽은 RLS를 거쳐 온 줄만 세므로 언제나 보는 사람 기준으로 맞다 — 같은 화면에서
-- 두 숫자가 부딪히는 일은 없다(`PostDetail`에는 `commentCount`가 없다).
--
-- insert와 delete가 대칭인 것은 4번이 `is_secret`을 잠근 덕이다. 값이 바뀔 수 있었다면
-- "안 세고 넣은 것을 빼는" 경우가 생겨 바닥의 `greatest(0, ...)`가 실제로 걸렸을 것이다.
-- -----------------------------------------------------------------------------
create or replace function sync_post_comment_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_secret then
      return null;
    end if;
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    if old.is_secret then
      return null;
    end if;
    -- greatest로 바닥을 둔다. 어긋나더라도 음수가 화면에 적히는 것보다 낫다.
    update posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;

  return null;   -- after 트리거라 반환값은 쓰이지 않는다.
end;
$$;

comment on column posts.comment_count is
  '공개 댓글 개수(대댓글 포함, 비밀 댓글 제외). comments 트리거가 유지한다. 직접 쓰지 않는다.';

-- 뜻이 바뀌었으니 한 번 맞춰 둔다. 지금 이 저장소에는 비밀 댓글이 0건이라 바뀌는 행이
-- 없지만, 0020·0028이 그랬듯 이 파일은 다른 환경에서도 같게 돌아야 한다.
update posts p
   set comment_count = (
     select count(*) from comments c where c.post_id = p.id and not c.is_secret
   )
 where p.comment_count is distinct from (
     select count(*) from comments c where c.post_id = p.id and not c.is_secret
   );

-- -----------------------------------------------------------------------------
-- 6. 알림은 손대지 않는다
--
-- 파 보고 안 것이라 적어 둔다. 0018의 `notify_post_commented`가 알리는 상대는 둘이다.
--
--   게시물 판매자     — 3번의 네 번째 갈래로 비밀 댓글을 본다
--   부모 댓글 작성자  — 3번의 세 번째 갈래로 자기 실타래를 본다
--
-- **받는 사람이 곧 볼 수 있는 사람이다.** 우연이 아니라 같은 규칙에서 나온다 —
-- 알림은 "이 대화에 관계된 사람"에게 가고 비밀 댓글도 "이 대화에 관계된 사람"만 본다.
-- 조건을 따로 더할 자리가 없었다.
--
-- 미리보기도 그대로다. `fetch_notifications`는 security invoker라 `comments` join에
-- 3번의 정책이 그대로 걸린다(0018이 차단에 대해 적어 둔 그 성질이다). 볼 수 있는 사람이
-- 받으므로 내용이 정상적으로 채워지고, 혹 못 보게 되더라도 내용만 비고 줄은 남는다.
-- =============================================================================
