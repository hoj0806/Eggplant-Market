import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient } from '../shared/lib/queryClient';

type AppProvidersProps = {
  children: ReactNode;
};

function AppProviders(props: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  );
}

export default AppProviders;
