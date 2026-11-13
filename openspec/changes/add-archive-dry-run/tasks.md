# Tasks

## 1. Command
- [ ] 1.1 Add `--dry-run` to the `archive` command definition and its shell-completion entry
- [ ] 1.2 Thread `dryRun` through `ArchiveCommand`: imply `--yes`, require a change name, skip creating the archive directory, and return before claiming the destination
- [ ] 1.3 Human output: archive's preview, then the specs that would be written or retired, the totals, the destination, and a closing line saying no files were changed
- [ ] 1.4 JSON output: a top-level `dryRun: true` on success and on refusal

## 2. Tests
- [ ] 2.1 A change that would archive: totals and destination reported, the project tree unchanged, exit 0
- [ ] 2.2 Each refusal class gives archive's refusal and exit 1 with nothing changed: change validation, merge refusal, rebuilt-spec validation (last requirement removed without `retire_capabilities`), destination already taken
- [ ] 2.3 A dry run and a real archive agree on success or refusal for each case in 2.1 and 2.2
- [ ] 2.4 A declared retirement is reported and the main spec is left in place
- [ ] 2.5 `--skip-specs` and `--no-validate` combine as they do for archive; incomplete tasks are a warning
- [ ] 2.6 A missing change name is refused without prompting, in human and JSON modes
- [ ] 2.7 Reported paths match archive's on every platform (Windows CI)

## 3. Docs and release
- [ ] 3.1 Document `--dry-run` in `docs/cli.md`
- [ ] 3.2 Add a changeset
