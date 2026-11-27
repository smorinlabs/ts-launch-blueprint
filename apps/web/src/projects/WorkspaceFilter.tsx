// The workspace filter: a labelled input in a <form>. Enter or Apply sets the
// filter (submit-based, not per keystroke, so no debouncing); Clear empties
// it. When the applied filter changes elsewhere (Clear filter in an error
// view), the input follows. Not by re-mounting (a `key`): that would drop
// keyboard focus after every Enter.
import { type FormEvent, type ReactElement, useId, useState } from 'react';

/** Props: the applied filter, and what to do with a new one ('' = none). */
export interface WorkspaceFilterProps {
  value: string;
  onApply: (workspace: string) => void;
}

/** The filter form. */
export function WorkspaceFilter(props: WorkspaceFilterProps): ReactElement {
  const inputId = useId();
  const [draft, setDraft] = useState(props.value);
  // React's "adjust state when a prop changes" pattern, during render.
  const [applied, setApplied] = useState(props.value);
  if (props.value !== applied) {
    setApplied(props.value);
    setDraft(props.value);
  }
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    props.onApply(draft);
  };
  const clear = (): void => {
    setDraft('');
    props.onApply('');
  };
  return (
    <form className="workspace-filter" onSubmit={submit}>
      <label htmlFor={inputId}>Workspace</label>
      <div className="workspace-filter__row">
        <input
          id={inputId}
          name="workspace"
          type="text"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">Apply</button>
        <button type="button" className="button--secondary" onClick={clear}>
          Clear
        </button>
      </div>
    </form>
  );
}
