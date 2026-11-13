## ADDED Requirements

### Requirement: Archive Dry Run

The archive command SHALL support a `--dry-run` flag that reports what archiving a change would do, or why archive would refuse it, while leaving every file unchanged.

#### Scenario: Dry run of a change that would archive

- **WHEN** executing `openspec archive <change> --dry-run`
- **AND** `openspec archive <change> --yes` with the same other options would succeed
- **THEN** run every check archive runs before writing, including validation of each rebuilt spec
- **AND** report the specs that would be written or retired, the totals, and the archive folder the change would move to
- **AND** leave every main spec, the change directory, and the archive directory exactly as they were
- **AND** say that no files were changed
- **AND** exit with status 0

#### Scenario: Dry run of a change archive would refuse

- **WHEN** executing `openspec archive <change> --dry-run`
- **AND** `openspec archive <change> --yes` with the same other options would refuse the change
- **THEN** report the refusal archive would report
- **AND** leave every file exactly as it was
- **AND** exit with a non-zero status

#### Scenario: Dry run answers confirmations without prompting

- **WHEN** executing `openspec archive <change> --dry-run`
- **THEN** answer every confirmation archive would ask as `--yes` would, without prompting
- **AND** report incomplete tasks as a warning rather than a refusal

#### Scenario: Dry run without a change name

- **WHEN** executing `openspec archive --dry-run` without a change name
- **THEN** refuse without showing the interactive change list
- **AND** name the command with a change name as the fix
- **AND** exit with a non-zero status

#### Scenario: Dry run with other archive options

- **WHEN** `--dry-run` is combined with `--skip-specs` or `--no-validate`
- **THEN** report what archive with those options and `--yes` would do

#### Scenario: Dry run of a capability retirement

- **WHEN** a dry run finds a capability that archive would retire
- **THEN** report the main spec that would be deleted
- **AND** leave that spec in place

#### Scenario: Dry run with JSON output

- **WHEN** executing `openspec archive <change> --dry-run --json`
- **THEN** print the JSON `openspec archive <change> --json --yes` would print, with a top-level `dryRun` field set to `true`
- **AND** on success, describe what would happen in `archive`, with `path` naming the folder the change would move to
- **AND** on refusal, set `archive` to null and carry archive's diagnostic in `status`

#### Scenario: Paths in a dry run report

- **WHEN** a dry run reports the archive folder or a main spec path
- **THEN** report it in the same form archive does, built with the platform's path separator on macOS, Linux, and Windows
