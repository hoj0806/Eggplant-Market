import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { profileQueryKey } from './useProfileQuery';
import {
  completeProfileOnboarding,
  updateProfileRegion,
  type CompleteOnboardingInput,
  type UpdateProfileRegionInput,
} from '../api/profileApi';
import type { Profile } from '../types';

/**
 * 온보딩 저장 후 프로필 캐시를 즉시 갱신한다.
 * 갱신하지 않으면 라우트 가드가 낡은 값을 보고 다시 온보딩으로 되돌린다.
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

/** 동네 변경. 캐시를 같은 방식으로 갱신해야 화면이 바로 새 동네를 보여준다. */
export function useUpdateRegionMutation(): UseMutationResult<
  Profile,
  Error,
  UpdateProfileRegionInput
> {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, UpdateProfileRegionInput>({
    mutationFn: updateProfileRegion,
    onSuccess: function handleRegionUpdated(profile): void {
      queryClient.setQueryData(profileQueryKey(profile.id), profile);
    },
  });
}
