import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { profileQueryKey } from './useProfileQuery';
import { completeProfileOnboarding, type CompleteOnboardingInput } from '../api/profileApi';
import type { Profile } from '../types';

/**
 * 온보딩 저장 후 프로필 캐시를 즉시 갱신한다.
 * 갱신하지 않으면 라우트 가드가 낡은 onboardedAt(null)을 보고 다시 온보딩으로 되돌린다.
 */
export function useCompleteOnboardingMutation(): UseMutationResult<
  Profile,
  Error,
  CompleteOnboardingInput
> {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, CompleteOnboardingInput>({
    mutationFn: completeProfileOnboarding,
    onSuccess: function handleOnboarded(profile): void {
      queryClient.setQueryData(profileQueryKey(profile.id), profile);
    },
  });
}
