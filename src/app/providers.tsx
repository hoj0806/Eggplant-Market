import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import AuthSessionProvider from '../features/auth/components/authSessionProvider';
import { queryClient } from '../shared/lib/queryClient';

type AppProvidersProps = {
  children: ReactNode;
};

function AppProviders(props: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>{props.children}</AuthSessionProvider>
    </QueryClientProvider>
  );
}

export default AppProviders;
