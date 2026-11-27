// The page shell (D-054/D-055): the heading and the projects screen. No
// router yet: one page, with its filter in the URL.
import type { ReactElement } from 'react';

import { ProjectsPage } from './projects/ProjectsPage.js';

/** The app: one page, the projects screen. */
export function App(): ReactElement {
  return (
    <main className="app">
      <h1>Projects</h1>
      <ProjectsPage />
    </main>
  );
}
