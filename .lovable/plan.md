# Reports-only refinement

## Scope
- Modify only `src/v8/Reports.tsx`.
- Preserve report authorization, item scope, date filtering, and all non-report behavior.

## Changes
- Exclude system-generated updates from project activity rows while retaining current date and project/task scope.
- Reduce the project activity table to numbering and update details, prefixing related-task updates with the task title.
- Remove all attachment output and attachment references from the project PDF.
- Set both generated report documents to zero page margins and recreate their visual margins with internal padding; neutralize the print document title.
- Align the project, date, and print controls through one consistent labeled four-column responsive grid.

## Verification
- Run the TypeScript check and production build validation provided by the project harness.
- Open the reports screen in the preview and verify the control alignment and generated report markup.
