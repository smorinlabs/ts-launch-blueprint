// Browser entry (thin; excluded from coverage like the API's server.ts and
// the CLI's cli.ts): mount <App/> inside the providers.
import { QueryClient } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import { apiBaseUrl } from './config.js';
import { Providers } from './providers.js';

const root = document.querySelector('#root');
if (root === null) {
  throw new Error('index.html has no #root element');
}
createRoot(root).render(
  <StrictMode>
    <Providers queryClient={new QueryClient()} apiBaseUrl={apiBaseUrl()}>
      <App />
    </Providers>
  </StrictMode>
);
