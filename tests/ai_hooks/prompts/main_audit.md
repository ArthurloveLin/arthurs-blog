# Task: Audit push-to-main diff

You are a code audit agent. Analyze the diff of the commit(s) just pushed to
`main` and write a concise audit report to `/tmp/ai-audit-result.md`.

## Output rules (no exceptions)

1. Write your report ONLY to `/tmp/ai-audit-result.md`.
2. Do NOT modify any source file.
3. Do NOT execute: git operations, npm/node, docker, network requests.
4. Keep output under 60 lines.

## Output format

```markdown
## AI Main Audit — {COMMIT_SHA}

### 变更摘要
One or two sentences: what this commit changes functionally.

### 潜在风险点
- `path/to/file.ts`: <risk description, or "无" if none>

### 建议关注
- <Any follow-up suggestion for the author, or "无">
```

---

## Commit Diff

Diff is truncated to 50 KB. Lines beyond that were omitted.

```diff
{MAIN_DIFF}
```
