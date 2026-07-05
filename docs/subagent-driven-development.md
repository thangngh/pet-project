# Subagent‑Driven Development

## Purpose
Provide a lightweight guideline for using **sub‑agents**, **checkpoints**, **memory**, and **local audits** in this repository.

## Core Concepts
- **Sub‑Agents** – isolated agents launched via `Agent` tool for parallel exploration (research, code‑scan, design). Each runs in its own context; results are streamed back as text.
- **Checkpoints** – immutable snapshots of project state (file tree, hashes, task list). Stored under `.claude/memory/checkpoints/`. Used to detect drift after refactors.
- **Memory** – structured markdown facts in `.claude/memory/`. Each fact has front‑matter (`name`, `description`, `metadata.type`). Index in `MEMORY.md` is loaded each session.
- **Local Audit** – quick consistency scan of key docs (specs, CLAUDE.md, task list). Looks for stray references (e.g., `TenantContext`), missing sections, and ensures version sync.

## Workflow
1. **Explore** – launch sub‑agents to read files (`Read`), list (`Glob`), grep patterns (`Grep`).
2. **Audit** – run a local audit script (manual steps):
   - Verify no deprecated tokens (`TenantContext`).
   - Ensure `RequestIdentity` matches spec.
   - Confirm RBAC/ABAC section exists.
3. **Checkpoint** – after audit, create a checkpoint file (`memory/checkpoints/<date>.md`) summarising:
   - Spec SHA‑1, task list snapshot, audit results.
4. **Task Update** – mark completed tasks via `TaskUpdate`.
5. **Iterate** – if audit finds issues, create new tasks, repeat.

## References
- `docs/superpowers/specs/2026-07-05-pet-ecommerce-server-design.md` – main spec.
- `.claude/memory/` – memory files and checkpoint directory.
- `TaskList` – current tasks (#25, #26).
