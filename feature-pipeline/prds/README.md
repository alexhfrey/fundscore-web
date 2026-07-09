# PRDs

Minimal, clean functionality docs produced by `/spec-story` **only for stories that fail the clarity gate**
(ambiguous functionality, untestable "done", or an open product decision). Each gets ONE red-team round; if
questions remain they go to the owner. Clear stories skip this entirely and go straight to a lean spec in
`../specs/queue/`. A PRD describes *what & why* (behavior), not *how*.

**Acceptance numbers live in ONE file — the spec, not the PRD.** Once a PRD is folded into a spec, move
(don't copy) the quantified acceptance block into the spec and leave a pointer here ("acceptance quantified
in the spec"). The PRD keeps the owner decisions and behavior. Verbatim duplication is how a superseded
number survives in a stale copy (the serve-full-holdings acceptance block was triplicated and its canonical
row count moved underneath two of the copies).
