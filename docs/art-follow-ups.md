Art pipeline follow-up: create four additional player portraits so 4–8-player tables can avoid repeating the approved roster.

Layout polish follow-up: the 6–8 player radial table is functional and readable
at all supported viewports (verified by `apps/e2e/tests/table-geometry.spec.ts`),
but at the narrowest supported width (~760px) eight nameplates ring the table
tightly and adjacent plates may graze at the corners. A dedicated small-screen
treatment for seven- and eight-seat tables (e.g. shorter plates or a compact
name-only variant) would give more breathing room.
