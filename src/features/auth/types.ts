import type { Session, User } from '@supabase/supabase-js';

export type AuthSession = Session;
export type AuthUser = User;

/** 세션 확인 전에는 'loading'. 화면 깜빡임(로그인 화면 잠깐 노출)을 막기 위해 구분한다. */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * 가지마켓이 쓰는 로그인 방법. **이 둘이 전부다.**
 *
 * supabase-js의 `Provider`는 수십 개를 담고 있어 그대로 쓰면 화면이 "혹시 애플도?"를
 * 물어야 한다. 여기서 좁혀 두면 **버튼을 안 만든 프로바이더를 부를 길이 없다** —
 * `SOCIAL_PROVIDERS` 하나만 늘리면 화면과 API가 함께 따라온다.
 */
export type SocialProvider = 'google' | 'kakao';
