# `.claude/conventions/` — index

Project rules for Claude Code agents working on Talafee. The entry point is [`../../CLAUDE.md`](../../CLAUDE.md) at the repo root — that file is auto-loaded by Claude Code in every new chat. The files in this directory are referenced from there for detailed checklists.

| File | When to read |
|---|---|
| [`commit.md`](commit.md) | Before every `git commit`. Message format, what not to stage, mandatory handoff line. |
| [`deploy.md`](deploy.md) | **Deploy chat only.** Push + tar deploy + verification procedure. |
| [`add-provider.md`](add-provider.md) | Adding a new Iranian gold provider. The id touches 4 places — get it right. |
| [`add-page.md`](add-page.md) | Adding a new top-level HTML page. House style, skeleton, what not to add. |
| [`debug.md`](debug.md) | Diagnosing a bug. Layer map + most common bugs and where they live. |

These files are committed to git deliberately so every clone gets them. The rest of `.claude/` (workspace, settings.local.json, agent scratch) stays gitignored — see `.gitignore`.

If you're updating the rules: edit the file *in this directory*, commit it like any other change. The root `CLAUDE.md` only needs editing when adding/removing a top-level rule or convention file.
