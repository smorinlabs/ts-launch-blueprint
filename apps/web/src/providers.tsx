// TanStack Query and the typed tRPC client around the app; used by the
// browser entry (main.tsx) and the tests.
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactElement, type ReactNode, useState } from 'react';

import { createApiClient, TRPCProvider } from './trpc.js';

/** Wrap `children` with a query client and a tRPC client for `apiBaseUrl`. */
export function Providers(props: {
  queryClient: QueryClient;
  apiBaseUrl: string;
  children: ReactNode;
}): ReactElement {
  // Created once per mount: a new client on every render would hand
  // TRPCProvider a new prop each time.
  const [trpcClient] = useState(() => createApiClient(props.apiBaseUrl));
  return (
    <QueryClientProvider client={props.queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={props.queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
