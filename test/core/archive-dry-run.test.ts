import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ArchiveCommand } from '../../src/core/archive.js';
import { formatLocalDate } from '../../src/utils/date.js';
import { promises as fs, realpathSync } from 'fs';
import path from 'path';
import os from 'os';

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('../../src/utils/interactive.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/interactive.js')>();
  return { ...actual, confirmPrompt: vi.fn() };
});

const WIDGETS_SPEC = `# widgets Specification

## Purpose
Widgets are validated before they are stored for later use.

## Requirements
### Requirement: Widget validation
The system SHALL validate every widget before storing it.

#### Scenario: Valid widget
- **WHEN** a valid widget is submitted
- **THEN** it is stored
`;

const GADGETS_SPEC = `# gadgets Specification

## Purpose
Gadgets are tracked for the reporting dashboard until they are retired.

## Requirements
### Requirement: Gadget tracking
The system SHALL track every gadget.

#### Scenario: Track
- **WHEN** a gadget is created
- **THEN** it is tracked
`;

const ADD_IMPORT_DELTA = `## ADDED Requirements
### Requirement: Widget import
The system SHALL import widgets from JSON.

#### Scenario: Import
- **WHEN** a user imports a JSON file
- **THEN** its widgets are stored
`;

describe('archive --dry-run', () => {
  let tempDir: string;
  let openspecDir: string;
  const originalConsoleLog = console.log;
  const originalExitCode = process.exitCode;
  const originalXdgDataHome = process.env.XDG_DATA_HOME;

  beforeEach(async () => {
    tempDir = realpathSync.native(
      await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-archive-dry-run-'))
    );
    process.chdir(tempDir);
    process.env.XDG_DATA_HOME = path.join(tempDir, 'xdg-data');
    openspecDir = path.join(tempDir, 'openspec');
    await fs.mkdir(path.join(openspecDir, 'changes'), { recursive: true });
    await writeFile(path.join('specs', 'widgets', 'spec.md'), WIDGETS_SPEC);
    await writeFile(path.join('specs', 'gadgets', 'spec.md'), GADGETS_SPEC);
    console.log = vi.fn();
    process.exitCode = undefined;
  });

  afterEach(async () => {
    console.log = originalConsoleLog;
    process.exitCode = originalExitCode;
    if (originalXdgDataHome === undefined) {
      delete process.env.XDG_DATA_HOME;
    } else {
      process.env.XDG_DATA_HOME = originalXdgDataHome;
    }
    vi.clearAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  async function writeFile(relativeToOpenspec: string, content: string): Promise<void> {
    const target = path.join(openspecDir, relativeToOpenspec);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }

  async function createChange(
    name: string,
    deltas: Record<string, string>,
    options: { tasks?: string; metadata?: string } = {}
  ): Promise<void> {
    const changeRel = path.join('changes', name);
    await writeFile(
      path.join(changeRel, 'proposal.md'),
      '## Why\nThis change exists to exercise archive dry runs in a test.\n\n## What Changes\n- Adjust widgets.\n'
    );
    await writeFile(path.join(changeRel, 'tasks.md'), options.tasks ?? '- [x] 1.1 Done\n');
    if (options.metadata !== undefined) {
      await writeFile(path.join(changeRel, '.openspec.yaml'), options.metadata);
    }
    for (const [capability, delta] of Object.entries(deltas)) {
      await writeFile(path.join(changeRel, 'specs', capability, 'spec.md'), delta);
    }
  }

  /** Every directory and file under openspec/, with file contents. */
  async function snapshotTree(): Promise<Record<string, string>> {
    const snapshot: Record<string, string> = {};
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const key = path.relative(openspecDir, full);
        if (entry.isDirectory()) {
          snapshot[key] = '<dir>';
          await walk(full);
        } else {
          snapshot[key] = await fs.readFile(full, 'utf-8');
        }
      }
    };
    await walk(openspecDir);
    return snapshot;
  }

  function loggedLines(): string[] {
    return (console.log as unknown as ReturnType<typeof vi.fn>).mock.calls.flat().map(String);
  }

  function lastJson(): any {
    const jsonLine = loggedLines()
      .reverse()
      .find((entry) => entry.trimStart().startsWith('{'));
    expect(jsonLine).toBeDefined();
    return JSON.parse(jsonLine!);
  }

  async function runJson(
    name: string | undefined,
    options: Parameters<ArchiveCommand['execute']>[1]
  ): Promise<{ output: any; exitCode: typeof process.exitCode }> {
    (console.log as unknown as ReturnType<typeof vi.fn>).mockClear();
    process.exitCode = undefined;
    await new ArchiveCommand().execute(name, { ...options, json: true });
    const result = { output: lastJson(), exitCode: process.exitCode };
    process.exitCode = undefined;
    return result;
  }

  async function promptMocks() {
    const { select } = await import('@inquirer/prompts');
    const { confirmPrompt } = await import('../../src/utils/interactive.js');
    return {
      select: select as unknown as ReturnType<typeof vi.fn>,
      confirm: confirmPrompt as unknown as ReturnType<typeof vi.fn>,
    };
  }

  it('reports what would be archived and leaves the tree unchanged', async () => {
    await createChange('add-import', { widgets: ADD_IMPORT_DELTA });
    const before = await snapshotTree();

    await new ArchiveCommand().execute('add-import', { dryRun: true });

    expect(await snapshotTree()).toEqual(before);
    expect(process.exitCode).toBeUndefined();
    const lines = loggedLines();
    expect(lines).toContain('Would apply changes to openspec/specs/widgets/spec.md:');
    expect(lines).toContain('  + 1 added');
    expect(lines).toContain(
      `Would archive change 'add-import' as '${formatLocalDate()}-add-import'.`
    );
    expect(lines).toContain('Dry run: no files were changed.');
  });

  it('does not create the archive directory', async () => {
    await createChange('add-import', { widgets: ADD_IMPORT_DELTA });

    await new ArchiveCommand().execute('add-import', { dryRun: true, json: true });

    await expect(fs.stat(path.join(openspecDir, 'changes', 'archive'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('prints the JSON a real archive prints, marked as a dry run', async () => {
    await createChange('add-import', { widgets: ADD_IMPORT_DELTA });
    const archiveName = `${formatLocalDate()}-add-import`;

    const dry = await runJson('add-import', { dryRun: true });
    expect(dry.exitCode).toBeUndefined();
    expect(dry.output.dryRun).toBe(true);
    expect(dry.output.archive).toMatchObject({
      change: 'add-import',
      archivedAs: archiveName,
      path: path.join(openspecDir, 'changes', 'archive', archiveName),
      specsUpdated: true,
      totals: { added: 1, modified: 0, removed: 0, renamed: 0 },
    });

    const real = await runJson('add-import', { yes: true });
    expect(real.output.dryRun).toBeUndefined();
    expect(real.output.archive).toEqual(dry.output.archive);
    expect(real.output.root).toEqual(dry.output.root);
  });

  describe('refusals', () => {
    const archiveName = (change: string) => `${formatLocalDate()}-${change}`;

    const cases: Array<{
      title: string;
      code: string;
      setup: () => Promise<void>;
    }> = [
      {
        title: 'change validation fails',
        code: 'archive_validation_failed',
        setup: () =>
          createChange('target', {
            widgets:
              '## ADDED Requirements\n### Requirement: Widget import\nThe system SHALL import widgets.\n',
          }),
      },
      {
        title: 'the merge refuses a MODIFIED whose header is gone',
        code: 'archive_spec_update_failed',
        setup: () =>
          createChange('target', {
            widgets:
              '## MODIFIED Requirements\n### Requirement: Widget validation thoroughly\n' +
              'The system SHALL validate every widget thoroughly.\n\n' +
              '#### Scenario: Valid widget\n- **WHEN** a valid widget is submitted\n- **THEN** it is stored\n',
          }),
      },
      {
        title: 'a rebuilt spec fails validation',
        code: 'archive_spec_validation_failed',
        setup: () =>
          createChange('target', {
            gadgets:
              '## REMOVED Requirements\n### Requirement: Gadget tracking\n' +
              '**Reason**: Gadgets are retired.\n**Migration**: None.\n',
          }),
      },
      {
        title: 'the archive folder is already taken',
        code: 'archive_target_exists',
        setup: async () => {
          await createChange('target', { widgets: ADD_IMPORT_DELTA });
          await fs.mkdir(path.join(openspecDir, 'changes', 'archive', archiveName('target')), {
            recursive: true,
          });
        },
      },
    ];

    it.each(cases)('gives archive\'s refusal when $title', async ({ code, setup }) => {
      await setup();
      const before = await snapshotTree();

      const dry = await runJson('target', { dryRun: true });

      expect(await snapshotTree()).toEqual(before);
      expect(dry.exitCode).toBe(1);
      expect(dry.output.dryRun).toBe(true);
      expect(dry.output.archive).toBeNull();
      expect(dry.output.status[0].code).toBe(code);

      // A real archive agrees, so the dry run's answer is archive's own.
      const real = await runJson('target', { yes: true });
      expect(real.exitCode).toBe(1);
      expect(real.output.status).toEqual(dry.output.status);
    });

    it('exits non-zero in human mode and changes nothing', async () => {
      await cases[2].setup();
      const before = await snapshotTree();

      await new ArchiveCommand().execute('target', { dryRun: true });

      expect(process.exitCode).toBe(1);
      expect(await snapshotTree()).toEqual(before);
      expect(loggedLines()).toContain('Aborted. No files were changed.');
    });
  });

  it('reports a declared retirement and leaves the main spec in place', async () => {
    await createChange(
      'retire-gadgets',
      {
        gadgets:
          '## REMOVED Requirements\n### Requirement: Gadget tracking\n' +
          '**Reason**: Gadgets are retired.\n**Migration**: None.\n',
      },
      { metadata: 'schema: spec-driven\nretire_capabilities: true\n' }
    );
    const before = await snapshotTree();
    const shownPath = ['openspec', 'specs', 'gadgets', 'spec.md'].join('/');

    const dry = await runJson('retire-gadgets', { dryRun: true });

    expect(await snapshotTree()).toEqual(before);
    expect(dry.output.archive.specsUpdated).toBe(true);
    expect(dry.output.archive.totals).toEqual({ added: 0, modified: 0, removed: 1, renamed: 0 });
    expect(dry.output.archive.warnings).toEqual([
      `gadgets - capability would be retired; archive would delete the main spec ` +
        `(all requirements removed, declared by retire_capabilities) at ${shownPath}. ` +
        'Its section(s) would go with it: Purpose.',
    ]);

    // The real archive retires the same file it names.
    const real = await runJson('retire-gadgets', { yes: true });
    expect(real.output.archive.totals).toEqual(dry.output.archive.totals);
    expect(real.output.archive.warnings[0]).toContain(`at ${shownPath}.`);
    await expect(fs.stat(path.join(openspecDir, 'specs', 'gadgets', 'spec.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('combines with --skip-specs as archive does', async () => {
    await createChange('add-import', { widgets: ADD_IMPORT_DELTA });
    const before = await snapshotTree();

    const dry = await runJson('add-import', { dryRun: true, skipSpecs: true });

    expect(await snapshotTree()).toEqual(before);
    expect(dry.output.archive.specsUpdated).toBe(false);
    expect(dry.output.archive.totals).toBeUndefined();
  });

  it('combines with --no-validate without asking for confirmation', async () => {
    const { confirm } = await promptMocks();
    await createChange('add-import', { widgets: ADD_IMPORT_DELTA });
    const before = await snapshotTree();

    await new ArchiveCommand().execute('add-import', { dryRun: true, validate: false });

    expect(confirm).not.toHaveBeenCalled();
    expect(await snapshotTree()).toEqual(before);
    expect(process.exitCode).toBeUndefined();
    expect(loggedLines()).toContain('Dry run: no files were changed.');
  });

  it('reports incomplete tasks as a warning without prompting', async () => {
    const { confirm } = await promptMocks();
    await createChange('add-import', { widgets: ADD_IMPORT_DELTA }, { tasks: '- [x] 1.1 Done\n- [ ] 1.2 Open\n' });

    await new ArchiveCommand().execute('add-import', { dryRun: true });

    expect(confirm).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
    expect(loggedLines()).toContain(
      'Warning: 1 incomplete task(s) found. A dry run continues as --yes would.'
    );
  });

  describe('without a change name', () => {
    it('refuses in human mode without showing the change list', async () => {
      const { select } = await promptMocks();
      await createChange('add-import', { widgets: ADD_IMPORT_DELTA });

      await expect(new ArchiveCommand().execute(undefined, { dryRun: true })).rejects.toThrow(
        'A change name is required: archive --dry-run never prompts.'
      );
      expect(select).not.toHaveBeenCalled();
    });

    it('refuses in JSON mode with the command to run instead', async () => {
      const dry = await runJson(undefined, { dryRun: true });

      expect(dry.exitCode).toBe(1);
      expect(dry.output).toMatchObject({
        dryRun: true,
        archive: null,
        status: [
          {
            code: 'archive_change_name_required',
            fix: 'openspec archive <change-name> --dry-run --json',
          },
        ],
      });
    });
  });
});
