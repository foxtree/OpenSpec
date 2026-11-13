## Context

`ArchiveCommand.run` checks first and writes last, in this order:

1. Root and path guards, change resolution, the namespace-folder refusal.
2. Change validation, unless `--no-validate`.
3. Task progress: a prompt, or a warning under `--yes`.
4. The archive folder name, and a check that it is free.
5. The merge preview: `buildUpdatedSpec` and an outcome (write, retire, skip)
   for each capability.
6. The spec-update confirmation, unless `--yes`, then a re-check that no input
   changed while the prompt was open.
7. Validation of every rebuilt spec, unless `--no-validate`.
8. The destination claim, spec snapshots, spec writes, retirements, and the move
   of the change folder.

Steps 1 to 7 only read, apart from creating the archive directory between steps
4 and 5. Every refusal that depends on the change's content is raised by step 7.

## Goals / Non-Goals

**Goals**

- Answer exactly as `archive --yes` with the same other options would, without
  writing anything.
- Keep a single code path, so the answer cannot drift from what archive does.

**Non-goals**

- Listing operations by requirement. `openspec show <change> --json
  --deltas-only` already reports a change's operations.
- Having `openspec validate` call the same checks. That would close its own gap
  for refusals after the merge, and is a separate change once this one exists.
- Validating rebuilt specs strictly. Archive validates them in non-strict mode,
  and a dry run reports what archive would do.

## Decisions

### Stop after step 7, before the destination claim

The claim file, the snapshots, the writes, the retirements and the move are the
mutations. Returning just before the claim keeps every check archive makes and
none of its writes. The archive directory is not created either, so a dry run in
a project that has never archived leaves no empty `archive/` behind.

### A dry run implies `--yes`

The question a dry run answers is "would this archive succeed without anyone
answering prompts?", which is what CI and agents run. Implying `--yes` answers
every confirmation the way the unattended command would: incomplete tasks become
a warning, and the spec-update and `--no-validate` confirmations proceed.
Treating incomplete tasks as a refusal unless `--yes` is also passed was
considered and rejected: `--dry-run --yes` would then be the only useful
spelling, and the bare flag a trap.

### A change name is required

The interactive change list is a prompt, and a dry run never prompts. Without a
name it refuses with `archive_change_name_required` and names the command with a
change name, as `archive --json` already does.

### JSON marks the result, not just the success

`"dryRun": true` sits at the top level of both the success and the refusal
output, so a consumer can tell a dry run's result from a real archive without
inspecting `archive`. Everything else keeps the shape `archive --json` already
has. `archive.path` names the folder the change would move to, and
`archive.specsUpdated` says whether any spec would be written or retired.

### Retirements are reported, not performed

A real retirement records a warning naming the deleted file and how to restore
it. A dry run records that the capability would be retired and which file would
be deleted, with no recovery command, since nothing is deleted.

## Risks / Trade-offs

- **A dry run can go stale.** Another process can change a spec between the dry
  run and the real archive. The dry run reports the state when it ran, and
  archive's own re-checks still apply when it runs for real.
- **The early return could hide a later check.** If archive gains a refusal
  inside step 8, a dry run would not report it. Tests assert that a dry run and a
  real archive agree on success or refusal for each refusal class, so a new
  refusal placed after the stop point shows up as a failing test.
