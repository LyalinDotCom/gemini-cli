# Web fetch tool (`web_fetch`)

This document describes the `web_fetch` tool for the Gemini CLI.

## Description

Use `web_fetch` to summarize, compare, or extract information from web pages.
The `web_fetch` tool processes content from one or more URLs (up to 20) embedded
in a prompt. `web_fetch` takes a natural language prompt and returns a generated
response.

### Arguments

`web_fetch` takes one argument:

- `prompt` (string, required): A comprehensive prompt that includes the URL(s)
  (up to 20) to fetch and specific instructions on how to process their content.
  For example:
  `"Summarize https://example.com/article and extract key points from https://another.com/data"`.
  The prompt must contain at least one URL starting with `http://` or
  `https://`.

## How to use `web_fetch` with the Gemini CLI

To use `web_fetch` with the Gemini CLI, provide a natural language prompt that
contains URLs. The tool will ask for confirmation before fetching any URLs. Once
confirmed, the tool will process URLs through Gemini API's `urlContext`.

If the Gemini API cannot access the URL, the tool will fall back to fetching
content directly from the local machine. The tool will format the response,
including source attribution and citations where possible. The tool will then
provide the response to the user.

Usage:

```
web_fetch(prompt="Your prompt, including a URL such as https://google.com.")
```

## `web_fetch` examples

Summarize a single article:

```
web_fetch(prompt="Can you summarize the main points of https://example.com/news/latest")
```

Compare two articles:

```
web_fetch(prompt="What are the differences in the conclusions of these two papers: https://arxiv.org/abs/2401.0001 and https://arxiv.org/abs/2401.0002?")
```

## Fallback behavior

When the primary URL fetching method fails or for certain URLs, `web_fetch` uses
a fallback mechanism:

- **Private IP addresses:** URLs pointing to localhost or private network
  addresses are automatically handled via the fallback fetch.
- **Failed primary fetch:** If the Gemini API cannot access the URL, the tool
  automatically falls back to fetching content directly from your local machine.
- **GitHub URLs:** GitHub blob URLs (e.g.,
  `github.com/user/repo/blob/main/file.txt`) are automatically converted to raw
  URLs (`raw.githubusercontent.com/user/repo/main/file.txt`).
- **Content limit:** Fetched content is limited to 100,000 characters to ensure
  processing remains efficient.

## Source attribution

When fetching URLs, the tool includes source attribution and inline citations:

- Sources are listed at the end of the response with titles and URLs.
- Inline citation markers (e.g., `[1]`, `[2]`) are inserted in the response text
  to indicate where information came from specific sources.

## Important notes

- **URL validation:** All URLs must be valid and complete, starting with
  `http://` or `https://`, with a valid hostname (e.g., `example.com` or an IP
  address).
- **URL processing:** `web_fetch` primarily uses the Gemini API's `urlContext`
  feature to access and process URLs.
- **Output quality:** The quality of the output depends on the clarity of the
  instructions in the prompt.
- **Confirmation:** The tool asks for confirmation before fetching URLs. You can
  choose to proceed always to skip future confirmations.
