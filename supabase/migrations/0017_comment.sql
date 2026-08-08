-- =============================================================================
-- 0017_comment.sql — 게시물 댓글
--
-- `feature.md` §2.1의 "게시물에 댓글, 찜 가능" 중 찜만 되어 있었다. 테이블은 0001에 이미
-- 있고(comments, parent_id로 대댓글까지) RLS 네 개도 붙어 있어서 화면만 얹으면 도는 것처럼
-- 보인다. 그런데 그 정책이 0001에서 한 번도 다시 읽히지 않은 채였고, 두 군데가 비어 있다.
--
--   ① content가 자유 text다        — 빈 댓글도, 10만 자짜리 댓글도 들어간다
--   ② comments_select이 using(true) — 6단계에서 만든 차단이 여기만 비껴간다
--
-- 0013(reviews)·0014(reports)에서 되풀이된 것과 같은 자리다. 0001은 "테이블을 만드는" 파일이라
-- 값의 모양까지는 보지 않았고, 그 칸을 쓰는 화면이 생기는 지금이 처음 읽는 때다.
--
-- 이번에는 **1단 댓글까지만** 만든다. parent_id는 그대로 두되 아무도 채우지 않는다 —
-- 대댓글은 목록을 트리로 접었다 펴는 일이 따로 붙으므로 나눈다. 아래 ②의 정책은 그때도
-- 그대로 쓸 수 있게 parent_id를 보지 않는다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 내용의 모양
--
-- 0013이 reviews.comment에 300자를 건 것과 같은 이유다. 화면에서 막는 것은 실수를 줄이지만
-- 테이블에 직접 넣는 길이 열려 있는 한 마지막 방어선은 열에 있어야 한다.
--
-- btrim으로 보는 것이 핵심이다. 공백만 있는 댓글은 `length > 0`을 통과하면서 화면에는
-- 빈 줄로 남는다. 지울 수는 있지만 아무도 왜 있는지 모르는 줄이 생긴다.
--
-- 1000자는 후기(300자)보다 넉넉하다. 후기는 한 줄 평이지만 댓글은 물어보고 답하는 자리라
-- 길어질 이유가 있다.
-- -----------------------------------------------------------------------------
alter table comments drop constraint if exists comments_content_bounded;
alter table comments add constraint comments_content_bounded
  check (btrim(content) <> '' and char_length(content) <= 1000);

comment on column comments.content is
  '댓글 내용. 공백만 있는 값은 들어가지 못하고 1000자를 넘지 못한다(comments_content_bounded).';

-- -----------------------------------------------------------------------------
-- 2. 차단한 사람의 댓글은 보이지 않는다
--
-- 0014가 게시물 목록(search_posts)·채팅방 목록(fetch_chat_rooms)·새 대화(open_chat_room)·
-- 메시지 쓰기(messages_insert) 넷을 막았는데, 그때 댓글은 화면이 없어 자리 자체가 없었다.
-- 이제 다섯 번째가 생긴다.
--
-- **RPC가 아니라 정책에 둔다.** 0014는 목록 RPC 쪽에서 걸렀는데 그건 그 목록들이 이미
-- RPC였기 때문이다. 댓글은 PostgREST 임베드로 읽으므로(postApi가 seller:profiles를 읽는 방식)
-- 걸러낼 자리가 질의문에 없다. 정책에 두면 어느 경로로 읽든 같은 규칙이 걸리고,
-- 나중에 목록 RPC를 만들더라도 한 번 더 적을 필요가 없다.
--
-- 행마다 blocks를 뒤지지 않을까 — `private.blocked_user_ids()`는 인자가 없는 stable 함수라
-- 질의당 한 번만 계산된다(InitPlan). 0014가 배열 하나로 만들어 둔 이유가 이것이다.
--
-- 빈 배열에 대한 `<> all`은 참이다. 비로그인 사용자는 auth.uid()가 null이라 배열이 비고,
-- 따라서 아무도 걸러지지 않는다 — 차단은 로그인한 사람의 관계이므로 맞는 동작이다.
--
-- 내 댓글이 나에게 안 보이는 일은 없다. 자기 자신은 차단할 수 없다(0014의 blocks 제약).
-- -----------------------------------------------------------------------------
drop policy if exists comments_select on comments;
create policy comments_select on comments
  for select
  using (author_id <> all (private.blocked_user_ids()));

-- -----------------------------------------------------------------------------
-- 3. 쓰기 — 차단한 사람의 글에는 쓰지 못한다
--
-- 0001의 comments_insert는 `auth.uid() = author_id` 하나뿐이다. 여기에 더할 것은 하나다.
--
-- "지워진 글에 댓글이 들어가지 않나"부터 확인했는데 그건 이미 막혀 있다 — post_id가 FK라
-- 없는 글을 가리키면 insert 자체가 실패한다. `posts_select`도 `using (true)`라 "볼 수 있는
-- 글인가"를 따로 물을 것이 없다. 게시물은 누구에게나 공개다.
--
-- 남는 것은 차단이다. 차단하면 그 사람 글은 목록에서 안 보이는데(search_posts),
-- 주소를 직접 치면 상세는 열린다. 그 자리에서 댓글까지 써지면 "차단했는데 계속 말이 오간다"가
-- 된다 — 0014가 open_chat_room·messages_insert에서 막은 그 길이다.
--
-- 수정 정책(comments_update)은 0001 그대로 둔다. 화면은 붙이지 않는다 — 고칠 수 있게 하려면
-- "수정됨" 표시가 따라와야 하고(게시물이 아직 안 하고 있다), 그 판단은 이번 범위가 아니다.
-- 정책만 남아 있는 것은 위험하지 않다. 작성자 본인만 통과한다.
-- -----------------------------------------------------------------------------
drop policy if exists comments_insert on comments;
create policy comments_insert on comments
  for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1
        from posts p
       where p.id = comments.post_id
         and not private.is_blocked(auth.uid(), p.seller_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 4. 삭제 — 글쓴이도 지울 수 있다
--
-- 0001은 댓글 작성자만 지울 수 있게 했다. 여기에 **게시물 판매자**를 더한다.
-- 내 글에 달린 댓글을 내가 못 지우면, 광고나 시비를 지우는 유일한 길이 신고뿐이 된다.
-- 신고는 즉시 아무것도 감추지 않으므로(0014) 그 사이 글은 그대로 남는다.
--
-- 당근도 같다 — 게시물 주인은 자기 글의 댓글을 지울 수 있다.
-- -----------------------------------------------------------------------------
drop policy if exists comments_delete on comments;
create policy comments_delete on comments
  for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from posts p where p.id = comments.post_id and p.seller_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 5. 목록 순서를 받는 인덱스
--
-- 0001의 comments_post_idx는 (post_id) 하나다. 한 글의 댓글을 시간순으로 읽으므로
-- 정렬 칸까지 넣어 둔다. 오래된 것이 위다 — 댓글은 위에서 아래로 읽는 대화이고,
-- 새 댓글이 맨 위로 오면 답이 물음보다 먼저 보인다(0015의 알림 목록과 반대다).
-- -----------------------------------------------------------------------------
drop index if exists comments_post_idx;
create index comments_post_created_idx on comments (post_id, created_at);
