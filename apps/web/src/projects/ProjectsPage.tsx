// The projects screen (D-055): the workspace filter (kept in the URL), the
// typed projects.list query, and one view per state. The pattern to copy for
// a new screen: typed queryOptions, QueryMessage/QueryError, URL state.
import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { useTRPC } from '../trpc.js';
import { ProjectsTable, projectCount } from './ProjectsTable.js';
import { QueryError, QueryMessage } from './QueryStatus.js';
import { useWorkspaceParam } from './workspace-param.js';
import { WorkspaceFilter } from './WorkspaceFilter.js';

/** The filter, the count and the results. */
export function ProjectsPage(): ReactElement {
  const [workspace, setWorkspace] = useWorkspaceParam();
  const trpc = useTRPC();
  // No filter sends no input (the API's input is optional, D-048). Matching
  // is the API's job (case-insensitive), so nothing is filtered here.
  const projects = useQuery(
    trpc.projects.list.queryOptions(workspace === '' ? undefined : { workspaceName: workspace })
  );

  let results: ReactElement;
  if (projects.isPending) {
    results = <QueryMessage>Loading projects…</QueryMessage>;
  } else if (projects.isError) {
    results = (
      <QueryError
        error={projects.error}
        onRetry={() => void projects.refetch()}
        onClearFilter={() => setWorkspace('')}
      />
    );
  } else if (projects.data.projects.length === 0) {
    results = (
      <QueryMessage>
        No projects found{workspace === '' ? '' : ` in workspace "${workspace}"`}.
      </QueryMessage>
    );
  } else {
    results = <ProjectsTable projects={projects.data.projects} />;
  }

  return (
    <section className="projects-page">
      <div className="projects-page__toolbar">
        <WorkspaceFilter value={workspace} onApply={setWorkspace} />
        <p className="projects-count" aria-live="polite">
          {projects.isSuccess ? projectCount(projects.data.projects.length) : ''}
        </p>
      </div>
      <div className="projects-page__results" aria-busy={projects.isPending}>
        {results}
      </div>
    </section>
  );
}
