---
"@fission-ai/openspec": minor
---

`openspec archive <change> --dry-run` reports what archiving would do, or why archive would refuse, without changing any file. It runs every check archive runs before writing, as `--yes` would, including validation of each rebuilt spec, which `openspec validate` does not run. It exits 0 when the archive would succeed and non-zero with archive's own refusal when it would not, so CI can check that a change still archives cleanly. With `--json`, the output is what `archive --json --yes` prints, plus `"dryRun": true`.
