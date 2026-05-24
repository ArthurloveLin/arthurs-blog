# Task: Generate AI Changelog Entry

You are a changelog generation agent. Based on the git commit log below, write a
changelog entry for the new release and save it to `/tmp/ai-changelog.md`.

## Output rules (no exceptions)

1. Write your output ONLY to `/tmp/ai-changelog.md`.
2. Do NOT modify any other file.
3. Do NOT execute: git operations, docker commands, network requests, file writes to other paths.
4. Keep output between 30 and 60 lines.
5. Do NOT fabricate entries — only document what is evident from the commit messages provided.
6. If the commit log is empty or unclear, write a minimal entry noting the version with no details.

## Output format

Use [Keep a Changelog](https://keepachangelog.com) style, grouped by type.
Only include sections that have entries. Omit empty sections.

```markdown
## {NEW_TAG} — $(date +%Y-%m-%d)

### ✨ Features
- <feat commit description>

### 🐛 Bug Fixes
- <fix commit description>

### ♻️ Refactor
- <refactor commit description>

### 🧹 Chore
- <chore/ci/docs/build commit description>
```

**Classification rules:**
- `feat:` / `feature:` → Features
- `fix:` / `bugfix:` → Bug Fixes
- `refactor:` → Refactor
- `chore:` / `ci:` / `build:` / `docs:` / `test:` → Chore
- Commits without a conventional prefix → use best judgment, default to Chore
- Merge commits and `[skip ci]` commits → omit

---

## Release Info

- New version tag: `{NEW_TAG}`
- Previous version tag: `{PREV_TAG}`

## Git Log

```
{GIT_LOG}
```
