# Binary Extensions - Implementation Changes

## Overview

This document describes the changes needed to support executable command
extensions in Gemini CLI.

## Changes Required

### 1. Extension Manifest Schema

Add support for `commands` field with executable type:

```typescript
// In extension manifest type definitions
interface ExtensionManifest {
  name: string;
  version: string;
  // ... existing fields ...

  // NEW: Executable commands
  commands?: {
    [commandName: string]: ExecutableCommandDef;
  };
}

interface ExecutableCommandDef {
  type: 'executable';
  binary: string; // Path template: "${extensionPath}/bin/${platform}/${arch}/gallery"
  description?: string;
  subcommands?: string[]; // Optional subcommand names
  requireConfirm?: boolean; // Confirmation before execution (default: false)
  env?: Record<string, string>; // Environment variables
}
```

### 2. FileCommandLoader Changes

**File:** `packages/cli/src/services/FileCommandLoader.ts`

#### A. Add Executable Command Loading

In `loadCommands()` method, after loading TOML commands:

```typescript
async loadCommands(signal: AbortSignal): Promise<SlashCommand[]> {
  const allCommands: SlashCommand[] = [];

  // ... existing TOML loading code ...

  // NEW: Load executable commands from extensions
  const executableCommands = await this.loadExecutableCommands(signal);
  allCommands.push(...executableCommands);

  return allCommands;
}
```

#### B. Implement Executable Command Discovery

```typescript
private async loadExecutableCommands(signal: AbortSignal): Promise<SlashCommand[]> {
  const commands: SlashCommand[] = [];

  if (!this.config) {
    return commands;
  }

  const extensions = this.config
    .getExtensions()
    .filter((ext) => ext.isActive);

  for (const ext of extensions) {
    try {
      // Read extension manifest
      const manifestPath = path.join(ext.path, 'gemini-extension.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      if (!manifest.commands) {
        continue;
      }

      // Process each command definition
      for (const [cmdName, cmdDef] of Object.entries(manifest.commands)) {
        if (cmdDef.type === 'executable') {
          const command = this.createExecutableCommand(
            cmdName,
            cmdDef,
            ext
          );
          if (command) {
            commands.push(command);
          }
        }
      }
    } catch (error) {
      console.error(
        `[FileCommandLoader] Failed to load executable commands from ${ext.name}:`,
        error
      );
    }
  }

  return commands;
}
```

#### C. Create Executable Command Wrapper

```typescript
private createExecutableCommand(
  name: string,
  def: ExecutableCommandDef,
  extension: Extension
): SlashCommand | null {
  try {
    // Resolve binary path with template variables
    const binaryPath = this.resolveBinaryPath(def.binary, extension.path);

    // Check if binary exists
    if (!fs.existsSync(binaryPath)) {
      console.warn(
        `[FileCommandLoader] Binary not found for command ${name}: ${binaryPath}`
      );
      return null;
    }

    return {
      name,
      description: def.description || `Execute ${name}`,
      kind: CommandKind.FILE,
      extensionName: extension.name,

      action: async (context: CommandContext, args: string) => {
        return await this.executeCommand(binaryPath, args, context, def);
      },

      // Support subcommands if defined
      subCommands: def.subcommands?.map(sub => ({
        name: sub,
        description: `${name} ${sub}`,
        kind: CommandKind.FILE,
        action: async (context: CommandContext, args: string) => {
          return await this.executeCommand(binaryPath, `${sub} ${args}`, context, def);
        }
      }))
    };
  } catch (error) {
    console.error(
      `[FileCommandLoader] Failed to create executable command ${name}:`,
      error
    );
    return null;
  }
}
```

#### D. Resolve Binary Path

```typescript
private resolveBinaryPath(template: string, extensionPath: string): string {
  return template
    .replace(/\${extensionPath}/g, extensionPath)
    .replace(/\${platform}/g, process.platform)
    .replace(/\${arch}/g, process.arch)
    .replace(/\${\/}/g, path.sep);
}
```

#### E. Execute Binary Command

```typescript
private async executeCommand(
  binaryPath: string,
  args: string,
  context: CommandContext,
  def: ExecutableCommandDef
): Promise<SlashCommandActionReturn> {
  const { spawn } = require('child_process');

  // Handle confirmation if required
  if (def.requireConfirm) {
    // TODO: Implement confirmation dialog
    // Similar to shell command confirmation
  }

  return new Promise((resolve) => {
    const argArray = args.trim().split(/\s+/).filter(a => a.length > 0);
    const proc = spawn(binaryPath, argArray, {
      cwd: context.services.config?.getProjectRoot() || process.cwd(),
      env: {
        ...process.env,
        ...def.env,
        GEMINI_CLI: '1' // Mark as running from Gemini CLI
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code: number) => {
      if (code !== 0) {
        resolve({
          type: 'message',
          messageType: 'error',
          content: stderr || `Command exited with code ${code}`
        });
      } else {
        resolve({
          type: 'message',
          messageType: 'info',
          content: stdout
        });
      }
    });

    proc.on('error', (error: Error) => {
      resolve({
        type: 'message',
        messageType: 'error',
        content: `Failed to execute command: ${error.message}`
      });
    });
  });
}
```

### 3. Type Definitions

Add to appropriate type files:

```typescript
interface ExecutableCommandDef {
  type: 'executable';
  binary: string;
  description?: string;
  subcommands?: string[];
  requireConfirm?: boolean;
  env?: Record<string, string>;
}
```

## Testing

### Manual Test Steps

1. Build the CLI:

   ```bash
   cd gemini-cli
   npm ci
   npm run build
   ```

2. Install gallery extension:

   ```bash
   npm run start
   # In CLI:
   > extensions install /path/to/gemini-cli-gallery-ext
   ```

3. Restart CLI and test:
   ```
   > /gallery list
   > /gallery search terraform
   > /gallery show chrome-devtools-mcp
   ```

### Expected Behavior

- Commands should execute instantly
- Output should be displayed in CLI
- Errors should be handled gracefully
- Binary not found should show warning

## Security Considerations

1. **Binary Verification**:
   - Check binary exists before execution
   - Verify it's in extension directory (no path traversal)

2. **Confirmation**:
   - Support `requireConfirm` flag
   - Similar to shell command confirmation

3. **Environment**:
   - Inherit CLI environment
   - Add custom env vars from manifest
   - Set `GEMINI_CLI=1` marker

4. **Sandboxing**:
   - Respect CLI sandbox settings (future work)
   - Execute in project directory

## Future Enhancements

1. **Streaming Output**: Real-time output display during execution
2. **Interactive Mode**: Support stdin for interactive tools
3. **Progress Indicators**: Show spinner during long operations
4. **Error Recovery**: Better error messages and debugging
5. **Binary Validation**: Optional signature verification
6. **Performance**: Binary execution caching/pooling

## Notes

- This is a minimal implementation for prototype
- Production version would need more robust error handling
- Consider security audit before production release
- May need TypeScript type updates in multiple files

## Files Modified

1. `packages/cli/src/services/FileCommandLoader.ts` - Main changes
2. Type definition files (as needed)
3. Extension manifest types (as needed)

## Backward Compatibility

✅ Fully backward compatible ✅ Existing TOML commands unaffected ✅ Existing
MCP servers unaffected ✅ Extensions without `commands` field unchanged
