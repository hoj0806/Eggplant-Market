1.회원가입

2.로그인

3.로그아웃

(이메일, 구글 로그인)
남은 것 — 대시보드 설정 2개 (코드로는 불가)

1. 구글 로그인 미활성화: Google Cloud Console에서 OAuth 클라이언트 생성 → 승인된 리디렉션 URI에 https://hcmpbpeyhmmismxjkkzv.supabase.co/auth/v1/callback 등록 → Supabase Dashboard > Authentication > Providers > Google에 Client ID/Secret 입력. 코드는 준비돼 있어 켜기만 하면 동작합니다.
2. 이메일 회원가입이 실제로는 메일 발송에서 막힘: Confirm email이 켜져 있는데 무료 프로젝트 내장 SMTP가 rate limit(over_email_send_rate_limit)입니다. 개발 중에는 Authentication > Sign In / Providers > Email에서 Confirm email을 끄는 것을 권합니다. (참고로 Supabase가 MX 없는 도메인 — example.com 등 — 을 거부하므로 테스트 이메일도 실제 도메인이어야 합니다.)

즉 로그인·로그아웃은 지금 바로 동작하고, 회원가입·구글 로그인은 위 설정 후 동작합니다.
