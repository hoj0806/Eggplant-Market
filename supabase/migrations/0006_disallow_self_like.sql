-- =============================================================================
-- 자기 글은 찜할 수 없다
--
-- 조회수는 0005에서 이미 판매자 본인을 제외했다(increment_view_count).
-- 찜에도 같은 규칙이 있어야 한다 — 자기 글을 찜해 찜 개수를 올리면
-- "찜 많은 순" 정렬(feature.md 2.2)이 곧바로 의미를 잃는다.
--
-- 화면에서도 자기 글에는 찜 버튼을 그리지 않지만, 규칙은 서버가 들고 있어야 한다.
-- 클라이언트만 막으면 요청을 직접 만들어 얼마든지 우회할 수 있다.
--
-- 테이블 check 제약으로는 못 막는다. 판매자가 누구인지는 posts에 있고
-- check는 다른 테이블을 참조할 수 없다. 그래서 RLS insert 정책에 조건을 더한다.
-- =============================================================================

drop policy if exists likes_insert on likes;

create policy likes_insert on likes
  for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1
        from posts
       where posts.id = likes.post_id
         and posts.seller_id = auth.uid()
    )
  );
