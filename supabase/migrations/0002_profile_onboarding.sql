-- =============================================================================
-- 프로필 온보딩 — 최초 가입 시 닉네임·프로필 사진 설정
--
-- 이메일/구글 어느 쪽으로 가입하든 handle_new_user가 임시 닉네임(user_xxxxxxxx)으로
-- profiles 행을 먼저 만든다. 구글이 넘겨주는 이름·사진은 일부러 쓰지 않는다.
-- (실명 노출을 피하고, 두 가입 경로의 첫 경험을 같게 맞추기 위함)
-- onboarded_at이 비어 있으면 아직 온보딩을 마치지 않은 사용자다.
-- =============================================================================

alter table profiles
  add column if not exists onboarded_at timestamptz;

comment on column profiles.onboarded_at is
  '온보딩(닉네임·프로필 사진 설정) 완료 시각. null이면 미완료 → 앱이 온보딩 화면으로 보낸다.';

-- =============================================================================
-- 프로필 사진 저장소
-- 공개 버킷: 게시물·댓글·채팅 어디서든 아바타를 읽으므로 조회는 전체 공개.
-- 쓰기는 본인 폴더({user_id}/...)로만 제한한다.
-- 용량·형식은 클라이언트 검증과 별개로 서버에서도 막는다.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,                                                   -- 2MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_select      on storage.objects;
drop policy if exists avatars_insert_own  on storage.objects;
drop policy if exists avatars_update_own  on storage.objects;
drop policy if exists avatars_delete_own  on storage.objects;

create policy avatars_select on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
