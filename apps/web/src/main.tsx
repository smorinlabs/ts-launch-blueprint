// Browser entry (thin; excluded from coverage like the API's server.ts and
// the CLI's cli.ts): the stylesheet, then <App/> inside the providers, with
// the app's retry policy (src/query-client.ts).
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import { apiBaseUrl } from './config.js';
import { Providers } from './providers.js';
import { createQueryClient } from './query-client.js';

const root = document.querySelector('#root');
if (root === null) {
  throw new Error('index.html has no #root element');
}
createRoot(root).render(
  <StrictMode>
    <Providers queryClient={createQueryClient()} apiBaseUrl={apiBaseUrl()}>
      <App />
    </Providers>
  </StrictMode>
);
