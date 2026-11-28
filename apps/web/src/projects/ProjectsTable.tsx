// The projects table and its count. Row types come from the API's router
// (`ProjectsListOutput`), so the table can't drift from what the API returns.
import type { ReactElement } from 'react';

import type { ProjectsListOutput } from '../trpc.js';

/** `4 projects`, `1 project`. */
export function projectCount(count: number): string {
  return `${count} ${count === 1 ? 'project' : 'projects'}`;
}

/** A bordered table (Project, Workspace); it scrolls inside its wrapper on
 * narrow screens, never the page. */
export function ProjectsTable(props: { projects: ProjectsListOutput['projects'] }): ReactElement {
  return (
    <div className="table-wrapper">
      <table className="projects-table">
        <caption className="visually-hidden">Projects</caption>
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Workspace</th>
          </tr>
        </thead>
        <tbody>
          {props.projects.map((project) => (
            <tr key={project.id}>
              <td>{project.name}</td>
              <td>{project.workspace?.name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
