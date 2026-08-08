import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import AuthSessionProvider from '../features/auth/components/authSessionProvider';
import { useApplyTheme } from '../shared/hooks/useApplyTheme';
import { queryClient } from '../shared/lib/queryClient';

type AppProvidersProps = {
  children: ReactNode;
};

function AppProviders(props: AppProvidersProps) {
  // 테마는 화면이 아니라 <html>에 붙는다. 앱에서 가장 바깥인 여기가 그것을 맡을 유일한 자리다.
  useApplyTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>{props.children}</AuthSessionProvider>
    </QueryClientProvider>
  );
}

export default AppProviders;
