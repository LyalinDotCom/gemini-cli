# Model fallback and recovery

Gemini CLI automatically handles model failures by offering fallback options.
This feature provides resilience when your primary model is unavailable due to
quota limits or capacity issues.

For information on **Auto mode** (intelligent routing between Pro and Flash
based on task complexity), see [Gemini CLI models](./models.md#auto-mode-recommended).

## How it works

Model routing is managed by the `ModelAvailabilityService`, which monitors model
health and automatically routes requests to available models based on defined
policies.

1.  **Model failure:** If the currently selected model fails (e.g., due to quota
    or server errors), the CLI will iniate the fallback process.

2.  **User consent:** Depending on the failure and the model's policy, the CLI
    may prompt you to switch to a fallback model (by default always prompts
    you).

3.  **Model switch:** If approved, or if the policy allows for silent fallback,
    the CLI will use an available fallback model for the current turn or the
    remainder of the session.

### Model selection precedence

The model used by Gemini CLI is determined by the following order of precedence:

1.  **`--model` command-line flag:** A model specified with the `--model` flag
    when launching the CLI will always be used.
2.  **`GEMINI_MODEL` environment variable:** If the `--model` flag is not used,
    the CLI will use the model specified in the `GEMINI_MODEL` environment
    variable.
3.  **`model.name` in `settings.json`:** If neither of the above are set, the
    model specified in the `model.name` property of your `settings.json` file
    will be used.
4.  **Default model:** If none of the above are set, the default model will be
    used. The default model is `auto`
