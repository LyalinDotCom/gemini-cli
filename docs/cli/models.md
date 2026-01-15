# Gemini CLI models

Gemini CLI supports multiple Gemini models, each optimized for different use
cases. This guide helps you understand your options and choose the right model
for your tasks.

## Available models

### Gemini 3 (Preview)

The latest generation of Gemini models with enhanced reasoning capabilities.

| Model | Best for | Speed | Capability |
|-------|----------|-------|------------|
| **gemini-3-pro-preview** | Complex reasoning, multi-step problems, architecture decisions | Slower | Highest |
| **gemini-3-flash-preview** | Fast responses with strong reasoning | Fast | High |

**Requirements:** Enable Preview Features in `/settings` to access Gemini 3
models.

### Gemini 2.5 (Stable)

Production-ready models available to all users.

| Model | Best for | Speed | Capability |
|-------|----------|-------|------------|
| **gemini-2.5-pro** | Complex tasks, detailed analysis, code refactoring | Moderate | Very High |
| **gemini-2.5-flash** | Everyday coding tasks, quick iterations | Fast | High |
| **gemini-2.5-flash-lite** | Simple operations, syntax fixes, formatting | Fastest | Good |

## Auto mode (recommended)

Auto mode intelligently routes your requests to the optimal model based on task
complexity. This is the default and recommended setting.

### How Auto mode works

1. **Task analysis**: When you send a prompt, a lightweight classifier analyzes
   its complexity
2. **Smart routing**: Simple tasks (formatting, small edits) go to Flash for
   speed; complex tasks (architecture, debugging) go to Pro for capability
3. **Cost efficiency**: You get Pro-level results when needed, Flash-level speed
   when appropriate

### Auto mode options

| Option | Routes to | When to use |
|--------|-----------|-------------|
| **Auto (Gemini 2.5)** | gemini-2.5-pro or gemini-2.5-flash | Default, stable production use |
| **Auto (Gemini 3)** | gemini-3-pro-preview or gemini-3-flash-preview | Maximum capability (requires Preview Features) |

**Example routing decisions:**

- "Fix the typo in line 42" → Flash (simple task)
- "Add input validation" → Flash (straightforward implementation)
- "Debug this race condition" → Pro (complex reasoning required)
- "Design the authentication architecture" → Pro (multi-step planning)

## Selecting a model

### Using `/model` command

```
/model
```

This opens an interactive dialog with options:

- **Auto (Gemini 3)** - Intelligent routing using Gemini 3 models
- **Auto (Gemini 2.5)** - Intelligent routing using Gemini 2.5 models
- **Manual** - Select a specific model

### Using the `--model` flag

Specify a model on startup:

```bash
# Use Auto mode (default)
gemini

# Use a specific model
gemini --model gemini-2.5-pro
gemini --model gemini-2.5-flash
gemini --model gemini-2.5-flash-lite

# Use model aliases
gemini --model pro    # Resolves to latest pro model
gemini --model flash  # Resolves to latest flash model
```

### Using environment variables

```bash
export GEMINI_MODEL="gemini-2.5-pro"
gemini
```

### Using settings.json

```json
{
  "model": {
    "name": "auto"
  }
}
```

## Model aliases

Aliases provide convenient shortcuts that resolve to the appropriate model based
on your Preview Features setting.

| Alias | With Preview Features OFF | With Preview Features ON |
|-------|---------------------------|--------------------------|
| `auto` | auto-gemini-2.5 | auto-gemini-3 |
| `pro` | gemini-2.5-pro | gemini-3-pro-preview |
| `flash` | gemini-2.5-flash | gemini-3-flash-preview |
| `flash-lite` | gemini-2.5-flash-lite | gemini-2.5-flash-lite |

## Model selection precedence

When multiple sources specify a model, this order applies:

1. **`--model` flag** (highest priority)
2. **`GEMINI_MODEL` environment variable**
3. **`model.name` in settings.json**
4. **Default** (`auto`)

## Enabling Gemini 3

Gemini 3 models require Preview Features to be enabled:

1. Run `/settings` in Gemini CLI
2. Toggle **Preview Features** to `true`
3. Run `/model` and select **Auto (Gemini 3)**

For enterprise users on Gemini Code Assist, see
[Gemini 3 enterprise setup](../get-started/gemini-3.md#how-to-enable-gemini-3-with-gemini-cli-on-gemini-code-assist).

## Model fallback

When your primary model is unavailable (quota exceeded, capacity issues), Gemini
CLI offers fallback options:

- **Gemini 3 Pro** → Falls back to Gemini 2.5 Pro
- **Gemini 2.5 Pro** → Falls back to Gemini 2.5 Flash

You'll be prompted before any fallback occurs. For details, see
[Model routing](./model-routing.md).

## Choosing the right model

| Scenario | Recommended model |
|----------|-------------------|
| General development | Auto (Gemini 2.5) |
| Need maximum capability | Auto (Gemini 3) or `pro` |
| Speed is critical | `flash` or `flash-lite` |
| Complex debugging | `pro` |
| Quick syntax fixes | `flash-lite` |
| Experimenting with latest features | Auto (Gemini 3) |

## Advanced configuration

For power users who need fine-grained control over model parameters
(temperature, thinking budget, etc.), see
[Advanced model configuration](./generation-settings.md).

## Related documentation

- [Model routing and fallback](./model-routing.md)
- [Gemini 3 setup](../get-started/gemini-3.md)
- [Advanced model configuration](./generation-settings.md)
- [Quotas and pricing](../quota-and-pricing.md)
