# Report what archiving a change would do, without writing

## Why

`openspec validate <change>` mirrors part of what archive checks. It runs
archive's merge in memory and reports each delta the merge would refuse (#1710),
and it rejects a MODIFIED block that drops a scenario (#1477). Two gaps remain,
and with either one the only way to learn whether `openspec archive <change>`
would succeed right now is to archive:

- **Refusals after the merge.** Archive validates every rebuilt spec before it
  writes any of them, and refuses when one fails. `validate` does not run that
  step. A change that removes a capability's last requirement without declaring
  `retire_capabilities: true` passes `validate --strict` with no findings, and
  archive refuses it with "Spec must have at least one requirement".
- **No exit code for merge refusals.** `validate` reports them as INFO and exits
  0, even with `--strict`, because a missing target can belong to a sibling
  change that has not archived yet (#1112). A CI job that needs to know "this
  change archives now" has to match INFO message text.

Today the only reliable answer is to copy the tree, archive the copy, and read
the result.

## What Changes

- Add `--dry-run` to `openspec archive`. It runs every check archive runs before
  writing, with the same options and as `--yes` would: change validation, task
  status, the archive destination, the merge, validation of every rebuilt spec,
  and capability retirement. It stops before the first write.
- A dry run never prompts and never changes a file. No main spec is written or
  deleted, the change is not moved, and the archive directory is not created.
- It exits 0 when archive would succeed, and non-zero with archive's own refusal
  when archive would refuse.
- Human output shows archive's preview, then what would be written, retired and
  moved, and says that no files were changed.
- `--json` prints what `archive --json --yes` would print, plus a top-level
  `"dryRun": true`. On success `archive` describes what would happen; on refusal
  `archive` is null and `status` carries archive's diagnostic.
- A dry run needs a change name: the interactive change list is a prompt.

## Impact

- Affected specs: `cli-archive` (ADDED: Archive Dry Run)
- Affected code: `src/cli/index.ts`, `src/core/archive.ts`,
  `src/core/completions/command-registry.ts`
- Affected docs: `docs/cli.md` (`openspec archive` options and examples)
