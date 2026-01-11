# Git Gandalf

A local AI-powered git pre-commit hook that reviews staged changes and blocks high-risk commits using a locally running LLM.

## Overview

Git Gandalf intercepts git commits, sends the staged diff to LM Studio for analysis, and blocks the commit if the AI detects high-risk issues like hardcoded secrets, SQL injection patterns, or dangerous operations. Everything runs locally—no cloud APIs, no data leaves your machine.

## How It Works

1. Developer runs `git commit`
2. Git triggers the pre-commit hook
3. Hook pipes staged diff to `gitgandalf.js` via STDIN
4. Node.js script sends diff to LM Studio (localhost:1234)
5. Qwen2.5-Coder-Instruct model returns JSON with risk level (`low`, `medium`, `high`) and summary
6. Script exits with code 0 (allow) or 1 (block) based on risk level
7. Git proceeds or aborts the commit accordingly

## Architecture

**Pre-commit Hook**: Bash script at `.git/hooks/pre-commit` that captures the staged diff and pipes it to the Node.js script.

**Node.js Script**: `gitgandalf.js` reads diff from STDIN, sends it to LM Studio's OpenAI-compatible API, parses the JSON response, and exits with the appropriate code.

**LM Studio + Qwen2.5-Coder**: Local LLM server providing code analysis through an HTTP API on localhost:1234.

## Tech Stack

- Node.js (v18+)
- LM Studio (OpenAI-compatible API)
- Qwen2.5-Coder-Instruct model
- Git pre-commit hook (Bash)

## Setup & Usage

### Prerequisites

1. Node.js installed
2. LM Studio running with Qwen2.5-Coder-Instruct model loaded
3. LM Studio server running on `http://localhost:1234`

### Installation

1. Clone this repository
2. Copy `gitgandalf.js` to your project root
3. Create `.git/hooks/pre-commit`:
```bash
   #!/bin/bash
   git diff --cached | node gitgandalf.js
   exit $?
```
4. Make it executable:
```bash
   chmod +x .git/hooks/pre-commit
```

### Usage

Once installed, the hook runs automatically on every commit:
```bash
git add file.js
git commit -m "Add feature"
```

If the commit is blocked, review the AI's feedback, fix the issues, and commit again.

To bypass the hook in emergencies:
```bash
git commit --no-verify -m "Emergency fix"
```

## Exit Code Behavior

- **Exit 0**: Commit allowed (low or medium risk)
- **Exit 1**: Commit blocked (high risk detected)

The hook returns exit code 1 when the LLM identifies critical issues like hardcoded credentials, security vulnerabilities, or dangerous patterns. All other cases return 0.

## Limitations

- Adds 2-10 seconds per commit (depends on model speed)
- Large diffs may exceed model context window
- Requires LM Studio running locally
- No configuration options (fixed risk thresholds)
- AI may produce false positives on legitimate code patterns
- Each commit analyzed independently (no historical context)