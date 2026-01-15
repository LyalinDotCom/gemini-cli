# Web search tool (`google_web_search`)

This document describes the `google_web_search` tool.

- **Tool name:** `google_web_search`
- **Display name:** GoogleSearch
- **File:** `web-search.ts`

## Description

Use `google_web_search` to perform a web search using Google Search via the
Gemini API. The `google_web_search` tool returns a summary of web results with
sources and inline citations.

### Arguments

`google_web_search` takes one argument:

- `query` (string, required): The search query.

## How to use `google_web_search` with the Gemini CLI

The `google_web_search` tool sends a query to the Gemini API, which then
performs a web search. `google_web_search` will return a generated response
based on the search results, including citations and sources.

Usage:

```
google_web_search(query="Your query goes here.")
```

## `google_web_search` examples

Get information on a topic:

```
google_web_search(query="latest advancements in AI-powered code generation")
```

## Output format

The response includes:

- **Summary text:** A generated summary based on the search results, with inline
  citation markers (e.g., `[1]`, `[2]`) inserted to indicate which source each
  piece of information came from.
- **Sources list:** A formatted list of sources at the end of the response,
  showing the title and URL for each cited source.

Example output format:

```
Web search results for "your query":

The summary text with inline citations[1] appears here[2].

Sources:
[1] Page Title (https://example.com/page1)
[2] Another Page (https://example.com/page2)
```

## Important notes

- **Response returned:** The `google_web_search` tool returns a processed
  summary, not a raw list of search results.
- **Citations:** The response includes inline citations linked to sources used
  to generate the summary.
- **No confirmation:** This tool does not require user confirmation before
  executing searches.
