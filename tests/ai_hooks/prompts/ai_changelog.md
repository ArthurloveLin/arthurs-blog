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
7. **Write ALL content in Chinese (中文)**. Section headers, descriptions, and all prose must be in Chinese.

## Output format

Use [Keep a Changelog](https://keepachangelog.com) style, grouped by type.
Only include sections that have entries. Omit empty sections.

```markdown
## {NEW_TAG} — $(date +%Y-%m-%d)

### ✨ 新功能
- <功能描述>

### 🐛 问题修复
- <修复描述>

### ♻️ 代码重构
- <重构描述>

### 🧹 工程维护
- <chore/ci/docs/build 相关描述>
```

**分类规则（用中文描述每一项）：**
- `feat:` / `feature:` → 新功能
- `fix:` / `bugfix:` → 问题修复
- `refactor:` → 代码重构
- `chore:` / `ci:` / `build:` / `docs:` / `test:` → 工程维护
- 无 conventional 前缀的 commit → 凭上下文判断，默认归入工程维护
- Merge commit 和含 `[skip ci]` 的 commit → 忽略，不写入

---

## Release Info

- New version tag: `{NEW_TAG}`
- Previous version tag: `{PREV_TAG}`

## Git Log

```
{GIT_LOG}
```
