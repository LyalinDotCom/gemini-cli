# Gemini CLI file system tools

The Gemini CLI provides a comprehensive suite of tools for interacting with the
local file system. These tools allow the Gemini model to read from, write to,
list, search, and modify files and directories, all under your control and
typically with confirmation for sensitive operations.

**Note:** All file system tools operate within a `rootDirectory` (usually the
current working directory where you launched the CLI) for security. Paths that
you provide to these tools are generally expected to be absolute or are resolved
relative to this root directory.

## 1. `list_directory` (ReadFolder)

`list_directory` lists the names of files and subdirectories directly within a
specified directory path. It can optionally ignore entries matching provided
glob patterns.

- **Tool name:** `list_directory`
- **Display name:** ReadFolder
- **File:** `ls.ts`
- **Parameters:**
  - `dir_path` (string, required): The path to the directory to list.
  - `ignore` (array of strings, optional): A list of glob patterns to exclude
    from the listing (e.g., `["*.log", ".git"]`).
  - `file_filtering_options` (object, optional): Options for respecting ignore
    patterns.
    - `respect_git_ignore` (boolean, optional): Whether to respect `.gitignore`
      patterns when listing files. Only available in git repositories. Defaults
      to `true`.
    - `respect_gemini_ignore` (boolean, optional): Whether to respect
      `.geminiignore` patterns when listing files. Defaults to `true`.
- **Behavior:**
  - Returns a list of file and directory names.
  - Indicates whether each entry is a directory.
  - Sorts entries with directories first, then alphabetically.
  - Shows count of ignored files if any were filtered.
- **Output (`llmContent`):** A string like:
  `Directory listing for /path/to/your/folder:\n[DIR] subfolder1\nfile1.txt\nfile2.png`
- **Confirmation:** No.

## 2. `read_file` (ReadFile)

`read_file` reads and returns the content of a specified file. This tool handles
text, images (PNG, JPG, GIF, WEBP, SVG, BMP), audio files (MP3, WAV, AIFF, AAC,
OGG, FLAC), and PDF files. For text files, it can read specific line ranges.
Other binary file types are generally skipped.

- **Tool name:** `read_file`
- **Display name:** ReadFile
- **File:** `read-file.ts`
- **Parameters:**
  - `path` (string, required): The absolute path to the file to read.
  - `offset` (number, optional): For text files, the 0-based line number to
    start reading from. Requires `limit` to be set.
  - `limit` (number, optional): For text files, the maximum number of lines to
    read. If omitted, reads a default maximum (e.g., 2000 lines) or the entire
    file if feasible.
- **Behavior:**
  - For text files: Returns the content. If `offset` and `limit` are used,
    returns only that slice of lines. Indicates if content was truncated due to
    line limits or line length limits.
  - For image, audio, and PDF files: Returns the file content as a
    base64-encoded data structure suitable for model consumption.
  - For other binary files: Attempts to identify and skip them, returning a
    message indicating it's a generic binary file.
- **Output:** (`llmContent`):
  - For text files: The file content, potentially prefixed with a truncation
    message (e.g.,
    `[File content truncated: showing lines 1-100 of 500 total lines...]\nActual file content...`).
  - For image/audio/PDF files: An object containing `inlineData` with `mimeType`
    and base64 `data` (e.g.,
    `{ inlineData: { mimeType: 'image/png', data: 'base64encodedstring' } }`).
  - For other binary files: A message like
    `Cannot display content of binary file: /path/to/data.bin`.
- **Confirmation:** No.

## 3. `write_file` (WriteFile)

`write_file` writes content to a specified file. If the file exists, it will be
overwritten. If the file doesn't exist, it (and any necessary parent
directories) will be created.

- **Tool name:** `write_file`
- **Display name:** WriteFile
- **File:** `write-file.ts`
- **Parameters:**
  - `file_path` (string, required): The absolute path to the file to write to.
  - `content` (string, required): The content to write into the file.
- **Behavior:**
  - Writes the provided `content` to the `file_path`.
  - Creates parent directories if they don't exist.
- **Output (`llmContent`):** A success message, e.g.,
  `Successfully overwrote file: /path/to/your/file.txt` or
  `Successfully created and wrote to new file: /path/to/new/file.txt`.
- **Confirmation:** Yes. Shows a diff of changes and asks for user approval
  before writing.

## 4. `glob` (FindFiles)

`glob` finds files matching specific glob patterns (e.g., `src/**/*.ts`,
`*.md`), returning absolute paths sorted by modification time (newest first).

- **Tool name:** `glob`
- **Display name:** FindFiles
- **File:** `glob.ts`
- **Parameters:**
  - `pattern` (string, required): The glob pattern to match against (e.g.,
    `"*.py"`, `"src/**/*.js"`).
  - `dir_path` (string, optional): The absolute path to the directory to search
    within. If omitted, searches across all workspace directories.
  - `case_sensitive` (boolean, optional): Whether the search should be
    case-sensitive. Defaults to `false`.
  - `respect_git_ignore` (boolean, optional): Whether to respect `.gitignore`
    patterns when finding files. Only available in git repositories. Defaults to
    `true`.
  - `respect_gemini_ignore` (boolean, optional): Whether to respect
    `.geminiignore` patterns when finding files. Defaults to `true`.
- **Behavior:**
  - Searches for files matching the glob pattern within the specified directory
    or across all workspace directories if none specified.
  - Returns a list of absolute paths, sorted with the most recently modified
    files first (within the last 24 hours), followed by older files sorted
    alphabetically.
  - Ignores common nuisance directories like `node_modules` and `.git` by
    default.
- **Output (`llmContent`):** A message like:
  `Found 5 file(s) matching "*.ts" within src, sorted by modification time (newest first):\nsrc/file1.ts\nsrc/subdir/file2.ts...`
- **Confirmation:** No.

## 5. `search_file_content` (SearchText)

`search_file_content` searches for a regular expression pattern within the
content of files in a specified directory. Can filter files by a glob pattern.
Returns the lines containing matches, along with their file paths and line
numbers.

- **Tool name:** `search_file_content`
- **Display name:** SearchText
- **File:** `grep.ts`
- **Parameters:**
  - `pattern` (string, required): The regular expression (regex) to search for
    (e.g., `"function\\s+myFunction"`).
  - `dir_path` (string, optional): The absolute path to the directory to search
    within. If omitted, searches across all workspace directories.
  - `include` (string, optional): A glob pattern to filter which files are
    searched (e.g., `"*.js"`, `"*.{ts,tsx}"`). If omitted, searches all files
    (respecting common ignores).
- **Behavior:**
  - Uses `git grep` if available in a Git repository for speed; otherwise, falls
    back to system `grep` or a JavaScript-based search.
  - Returns a list of matching lines, each prefixed with its file path (relative
    to the search directory) and line number.
  - Searches are case-insensitive by default.
- **Output (`llmContent`):** A formatted string of matches, e.g.:
  ```
  Found 3 matches for pattern "myFunction" in path "." (filter: "*.ts"):
  ---
  File: src/utils.ts
  L15: export function myFunction() {
  L22:   myFunction.call();
  ---
  File: src/index.ts
  L5: import { myFunction } from './utils';
  ---
  ```
- **Confirmation:** No.

## 6. `replace` (Edit)

`replace` replaces text within a file. By default, replaces a single occurrence,
but can replace multiple occurrences when `expected_replacements` is specified.
This tool is designed for precise, targeted changes and requires significant
context around the `old_string` to ensure it modifies the correct location.

- **Tool name:** `replace`
- **Display name:** Edit
- **File:** `edit.ts`
- **Parameters:**
  - `file_path` (string, required): The path to the file to modify.
  - `instruction` (string, required): A clear, semantic instruction for the code
    change, acting as a high-quality prompt for an expert LLM assistant. It must
    be self-contained and explain the goal of the change. A good instruction
    should concisely answer: WHY is the change needed, WHERE should it happen,
    WHAT is the high-level change, and WHAT is the desired outcome.
  - `old_string` (string, required): The exact literal text to replace.

    **CRITICAL:** This string must uniquely identify the single instance to
    change. It should include at least 3 lines of context _before_ and _after_
    the target text, matching whitespace and indentation precisely. If
    `old_string` is empty, the tool attempts to create a new file at `file_path`
    with `new_string` as content.

  - `new_string` (string, required): The exact literal text to replace
    `old_string` with.
  - `expected_replacements` (number, optional): The number of occurrences to
    replace. Defaults to `1`. Use when you want to replace multiple occurrences.

- **Behavior:**
  - If `old_string` is empty and `file_path` does not exist, creates a new file
    with `new_string` as content.
  - If `old_string` is provided, it reads the `file_path` and attempts to find
    exactly one occurrence of `old_string`.
  - If one occurrence is found, it replaces it with `new_string`.
  - **Multi-strategy matching:** The tool uses multiple strategies to find the
    target text:
    1. **Exact match:** Attempts a literal string match first.
    2. **Flexible match:** If exact match fails, tries whitespace-insensitive
       matching while preserving indentation.
    3. **Regex match:** Falls back to a regex-based approach for structural
       matching.
  - **Enhanced reliability (self-correction):** If the initial match fails, the
    tool can leverage an LLM to iteratively refine `old_string` and
    `new_string`, making the operation more robust even with slightly imperfect
    initial context.
  - **User modification support:** Users can modify the `new_string` content
    during confirmation. If modified, this is reported in the response.
- **Failure conditions:** Despite the correction mechanism, the tool will fail
  if:
  - `file_path` is outside the workspace directories.
  - `old_string` is not empty, but the `file_path` does not exist.
  - `old_string` is empty, but the `file_path` already exists.
  - `old_string` is not found in the file after attempts to correct it.
  - `old_string` is found multiple times, and the self-correction mechanism
    cannot resolve it to a single, unambiguous match.
- **Output (`llmContent`):**
  - On success:
    `Successfully modified file: /path/to/file.txt (1 replacements).` or
    `Created new file: /path/to/new_file.txt with provided content.`
  - On failure: An error message explaining the reason (e.g.,
    `Failed to edit, 0 occurrences found...`,
    `Failed to edit, expected 1 occurrences but found 2...`).
- **Confirmation:** Yes. Shows a diff of the proposed changes and asks for user
  approval before writing to the file.

## 7. `read_many_files` (ReadManyFiles)

`read_many_files` reads content from multiple files matching glob patterns and
concatenates them into a single response. This tool is designed for getting an
overview of multiple files simultaneously, such as reviewing codebases or
analyzing collections of files.

- **Tool name:** `read_many_files`
- **Display name:** ReadManyFiles
- **File:** `read-many-files.ts`
- **Parameters:**
  - `include` (array of strings, required): Glob patterns or paths for files to
    include (e.g., `["src/**/*.ts", "*.md"]`, `["README.md", "docs/"]`).
  - `exclude` (array of strings, optional): Glob patterns for files to exclude
    (e.g., `["**/*.log", "temp/"]`). Added to default excludes if
    `useDefaultExcludes` is true.
  - `recursive` (boolean, optional): Whether to search recursively. Primarily
    controlled by `**` in glob patterns. Defaults to `true`.
  - `useDefaultExcludes` (boolean, optional): Whether to apply default exclusion
    patterns (like `node_modules`, `.git`, binary files). Defaults to `true`.
  - `file_filtering_options` (object, optional):
    - `respect_git_ignore` (boolean, optional): Whether to respect `.gitignore`.
      Only available in git repositories. Defaults to `true`.
    - `respect_gemini_ignore` (boolean, optional): Whether to respect
      `.geminiignore`. Defaults to `true`.
- **Behavior:**
  - Finds all files matching the include patterns across all workspace
    directories.
  - Excludes files matching exclude patterns.
  - Reads and concatenates content from matching files.
  - For text files, uses UTF-8 encoding and separates file contents with
    `--- {filePath} ---` headers, ending with `--- End of content ---`.
  - Handles images (PNG, JPG, GIF, WEBP, SVG, BMP), audio files (MP3, WAV,
    etc.), and PDFs only when explicitly requested by name or extension.
  - Shows warning if file content was truncated.
- **Output (`llmContent`):** Concatenated content from all matching files, with
  file path headers separating each file's content.
- **Confirmation:** No.
- **Use cases:**
  - Getting an overview of a codebase or directory structure.
  - Finding where specific functionality is implemented across files.
  - Reviewing multiple documentation files at once.
  - Gathering context from multiple configuration files.
  - Processing batch reads of code files (e.g., all TypeScript files in `src`).

**Example patterns:**

```text
# Read all TypeScript files in src
include: ["src/**/*.ts"]
exclude: ["**/*.test.ts"]

# Read specific documentation files
include: ["README.md", "docs/**/*.md"]

# Read all config files
include: ["*.json", "*.yaml", "*.yml"]
```

These file system tools provide a foundation for the Gemini CLI to understand
and interact with your local project context.
