# CLI Examples

This directory contains runnable examples for CLI components.

## TypeScript Configuration

This directory has two tsconfig files with different purposes:

### `tsconfig.json`

- **Purpose**: Type checking for IDE and `tsc -b` build validation
- **Extends**: Root `tsconfig.json`
- **Include**: Only `examples/` directory
- **Used by**: VS Code, `pnpm exec tsc -b`

This config is referenced by the root `tsconfig.json` to ensure examples are type-checked during builds without producing output files (`noEmit: true`).

### `tsconfig.run.json`

- **Purpose**: Runtime execution with `tsx`
- **Extends**: `apps/cli/tsconfig.json`
- **Include**: Both `src/` and `examples/` directories
- **Used by**: `pnpm run example` script

This config enables `tsx` to use the correct JSX transformation (`react-jsx`) for both source files and examples.

## Running Examples

From the `apps/cli` directory:

```bash
# Run an example
pnpm run example examples/src/<path-to-example>.tsx

# Debug an example (with Node.js inspector)
pnpm run example:debug examples/src/<path-to-example>.tsx
```

Or use VS Code:

- **Run**: `Cmd+Shift+P` → `Tasks: Run Task` → `Run CLI example`
- **Debug**: Press `F5` and select `Debug CLI Example`
