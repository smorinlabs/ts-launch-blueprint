// The web app's first page (D-054): projects.list through the typed client.
// Plain on purpose: styling and routing come with the projects screen.
import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { useTRPC } from './trpc.js';

/** Loading, the API's (already safe, D-049) error message, or the list. */
function ProjectList(): ReactElement {
  const trpc = useTRPC();
  const projects = useQuery(trpc.projects.list.queryOptions());
  if (projects.isPending) {
    return <p>Loading projects…</p>;
  }
  if (projects.isError) {
    return <p role="alert">{projects.error.message}</p>;
  }
  return (
    <ul>
      {projects.data.projects.map((project) => (
        <li key={project.id}>
          {project.name} ({project.workspace.name})
        </li>
      ))}
    </ul>
  );
}

/** The page: a heading and the project list. */
export function App(): ReactElement {
  return (
    <main>
      <h1>Projects</h1>
      <ProjectList />
    </main>
  );
}
