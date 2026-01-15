# Safety and Security

Gemini CLI includes multiple safety systems to protect users from unintended
actions and ensure secure operation.

## Loop detection

The loop detection service prevents the agent from getting stuck in infinite
loops when executing tasks.

### How it works

The service monitors:

- Repeated tool calls with identical parameters
- Circular patterns in agent reasoning
- Excessive iterations without progress

When a loop is detected:

1. Warning is displayed to the user
2. Agent is prompted to try a different approach
3. If loops persist, execution is terminated

### Configuration

Loop detection is enabled by default and cannot be disabled for safety reasons.

## Tool confirmation

Sensitive operations require user approval before execution.

### Confirmation types

| Type | Description | Example tools |
|------|-------------|---------------|
| `info` | Informational, low risk | `activate_skill` |
| `warning` | Moderate risk, review recommended | `write_file` |
| `danger` | High risk, careful review required | `run_shell_command` |

### Approval modes

The approval mode controls when confirmations are shown:

- **DEFAULT** - Show confirmations for risky operations
- **SUGGEST** - Show but don't require approval
- **YOLO** - Skip confirmations (use with caution)

Configure via:

```bash
# Enable YOLO mode (skip confirmations)
gemini --yolo

# Or via environment variable
GEMINI_YOLO_MODE=true gemini
```

### Tool kinds

Tools are classified by their effect:

| Kind | Description | Confirmation |
|------|-------------|--------------|
| `reader` | Read-only operations | None |
| `editor` | Modify existing files | Required |
| `creator` | Create new files | Required |
| `deleter` | Delete files | Required |
| `executor` | Run commands | Required |
| `mutator` | Any state change | Required |

## Environment sanitization

The CLI sanitizes environment variables before passing them to shell commands.

### Filtered variables

These patterns are filtered from the environment:

- `*_KEY` - API keys
- `*_SECRET` - Secrets
- `*_TOKEN` - Authentication tokens
- `*_PASSWORD` - Passwords
- `*CREDENTIALS*` - Credential files

### Preserved variables

Essential variables are preserved:

- `PATH` - Command locations
- `HOME` - User home directory
- `USER` - Username
- `SHELL` - Default shell
- `TERM` - Terminal type

## File access control

### Trusted folders

By default, Gemini CLI only operates on files within trusted folders:

- Current working directory
- Explicitly trusted folders via `/trust` command
- User-level gemini folder (`~/.gemini/`)

Files outside trusted folders require explicit confirmation.

### .geminiignore

Use `.geminiignore` to exclude files from agent access:

```gitignore
# Secrets
.env
*.pem
credentials.json

# Build artifacts
node_modules/
dist/
```

## Sandboxing

For maximum isolation, run Gemini CLI in a sandbox:

### macOS sandbox-exec

```bash
gemini --sandbox
```

Restricts:

- File system access to workspace
- Network access (configurable)
- Process creation

### Docker sandbox

```bash
gemini --sandbox=docker
```

Runs in an isolated container with:

- Read-only root filesystem
- Limited resources
- Network isolation

See [Sandboxing](../cli/sandbox.md) for detailed configuration.

## Policy engine

The policy engine provides fine-grained control over tool execution.

### Policy rules

Define rules to allow, deny, or require confirmation:

```json
{
  "policies": {
    "run_shell_command": {
      "action": "ask",
      "message": "Review this command carefully"
    },
    "write_file": {
      "action": "allow",
      "paths": ["src/**", "tests/**"]
    }
  }
}
```

### Actions

| Action | Description |
|--------|-------------|
| `allow` | Execute without confirmation |
| `deny` | Block execution |
| `ask` | Require user confirmation |

See [Policy Engine](./policy-engine.md) for complete documentation.

## Rate limiting

The CLI includes rate limiting to prevent:

- API quota exhaustion
- Runaway operations
- Accidental infinite loops

### Default limits

- API calls: Respects Gemini API quotas
- Tool calls per turn: 50
- File operations per session: 1000

## Audit logging

When telemetry is enabled, the CLI logs:

- Tool invocations and outcomes
- Configuration changes
- Error events

Logs are stored locally and optionally sent for analytics.

See [Telemetry](../cli/telemetry.md) for privacy details.

## Best practices

### For users

1. **Review confirmations** - Always read what actions are being taken
2. **Use sandboxing** - Enable for untrusted codebases
3. **Limit tool access** - Use minimal tool sets when possible
4. **Keep secrets separate** - Don't expose credentials in prompts

### For extension authors

1. **Request minimal permissions** - Only ask for what's needed
2. **Validate inputs** - Never trust user or model input
3. **Handle errors gracefully** - Don't expose internal details
4. **Document security implications** - Be clear about risks

## Related documentation

- [Policy Engine](./policy-engine.md) - Fine-grained tool control
- [Sandboxing](../cli/sandbox.md) - Isolated execution
- [Trusted Folders](../cli/trusted-folders.md) - Folder access control
- [Telemetry](../cli/telemetry.md) - Data collection policies
