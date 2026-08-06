import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { profileQueryKey } from './useProfileQuery';
import {
  completeProfileOnboarding,
  updateProfileBasics,
  updateProfileRegion,
  updateSearchRadius,
  type CompleteOnboardingInput,
  type UpdateProfileBasicsInput,
  type UpdateProfileRegionInput,
  type UpdateSearchRadiusInput,
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

/**
 * 닉네임·프로필 사진 변경.
 *
 * 캐시 갱신 방식은 위 둘과 같다. 다만 내 닉네임·사진은 프로필 쿼리 밖에도 복사본이 있다 —
 * 게시물 상세의 판매자 카드(`['post', …]`)가 그렇다. 그 쿼리는 조회 시점의 프로필을 통째로
 * 안고 있어서 profileQueryKey를 고쳐도 닿지 않는다. 다음 조회에서 맞춰지도록 무효화해 둔다.
 */
export function useUpdateProfileBasicsMutation(): UseMutationResult<
  Profile,
  Error,
  UpdateProfileBasicsInput
> {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, UpdateProfileBasicsInput>({
    mutationFn: updateProfileBasics,
    onSuccess: function handleProfileUpdated(profile): void {
      queryClient.setQueryData(profileQueryKey(profile.id), profile);
      queryClient.invalidateQueries({ queryKey: ['post'] });
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

/**
 * 검색 반경 변경.
 *
 * 목록 캐시는 건드리지 않는다. 반경이 검색 쿼리 키 안에 들어 있어서(`postSearchQueryKey`)
 * 값이 바뀌면 **다른 키**가 되고, 그 키에는 캐시가 없어 다시 불린다.
 * 무효화까지 하면 반경을 되돌렸을 때 남아 있었을 옛 목록까지 함께 버리게 된다.
 */
export function useUpdateSearchRadiusMutation(): UseMutationResult<
  Profile,
  Error,
  UpdateSearchRadiusInput
> {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, UpdateSearchRadiusInput>({
    mutationFn: updateSearchRadius,
    onSuccess: function handleRadiusUpdated(profile): void {
      queryClient.setQueryData(profileQueryKey(profile.id), profile);
    },
  });
}
