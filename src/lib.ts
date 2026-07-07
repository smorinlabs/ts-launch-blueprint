// Public library entry point. The root export is the only stable API surface
// (D-012(3)). Deliberately minimal in S1; the real API lands in S3.

export { VERSION } from './version.js';

// Placeholder domain type stub; fleshed out in S3 (API layer).
export interface Project {
  id: string;
  name: string;
}
