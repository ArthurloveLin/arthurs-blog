# Task: Generate pytest API integration tests

You are an automated test generation agent. Your job is to write new pytest test
files for the API coverage gaps listed in the Coverage Gaps Report below.

## Hard output rules (no exceptions)

1. Write ONLY to `tests/ai_generated/test_{domain}_{YYYYMMDD}.py`
   where `{domain}` is the endpoint domain word shown in the gap report
   and `{YYYYMMDD}` is today's date.
2. Do NOT modify any existing files.
3. Do NOT create files outside `tests/ai_generated/`.
4. Each output file MUST be under 150 lines.
5. Do NOT hallucinate endpoints — only test URLs that appear verbatim in the
   diff or source shown in the gap report.
6. Do NOT write tests that create, modify, or delete data without inline cleanup.

## Available fixtures (from tests/ai_generated/conftest.py)

```python
client        # httpx.Client — unauthenticated, scope=session
admin_client  # httpx.Client — admin session cookie, scope=session
              #   calls pytest.skip() automatically if no admin credentials
base_url      # str — TEST_BASE_URL env var (e.g. "http://localhost:3020")
```

## Pytest marks to use

```python
@pytest.mark.smoke   # fast, critical-path — include at least 1 per class
@pytest.mark.admin   # requires admin_client — always pair with admin_client fixture
@pytest.mark.write   # creates/modifies data — must clean up within the same test
```

## Test writing rules

- Use `allure.feature` + `allure.story` as class decorators.
- Assert on HTTP status codes and JSON structure — not on specific data values.
- Use `pytest.skip("reason")` when a test requires data that may not exist in CI.
- For Turnstile-protected endpoints: assert that an unauthenticated request
  without a valid token returns 400 or 403 — do NOT attempt to bypass Turnstile.
- For admin-only endpoints: assert the public `client` receives 401 or 403,
  then test the happy path with `admin_client`.
- Imports: `allure`, `pytest`, `httpx` only — no other imports.

## Banned patterns

- `/api/admin/*` endpoints (require service role, not safe to call in CI)
- File upload endpoints (multipart/form-data write paths)
- `time.sleep()` or `asyncio.sleep()`
- Imports from `tests.api`, `tests.e2e`, or any other test module
- Writing files to disk

## 环境约束（严格禁止）

你的唯一职责是**编写测试代码**，以及用 `pytest --collect-only` 做静态发现验证。
其余所有操作均由 CI 流水线负责，你不得介入：

**基础设施**
- 禁止启动或停止任何 Docker 容器（`docker run/start/stop/compose up/down` 等）
- 禁止启动任何构建或开发服务器（`npm run dev/build`、`next dev/build`、`npx`、`node` 等）

**网络**
- 禁止执行任何 HTTP 请求或网络调用（`curl`、`httpx`、`requests`、`fetch` 等，包括 localhost）
- 测试容器由流水线管理，你运行时它不存在，访问 localhost:3020 必然失败

**测试执行**
- 禁止以任何方式运行测试（`pytest`、`python -m pytest`、`python test_*.py` 等）
- 唯一允许的 pytest 调用是 `pytest --collect-only`，用于验证测试可被发现

**版本控制**
- 禁止执行任何 git 操作（`git commit`、`git push`、`git checkout`、`git add` 等）
- 禁止创建 Pull Request（`gh pr create` 等）
- 分支创建和 PR 提交由 CI 流水线在你完成后自动处理

**文件范围**
- 禁止修改 `docker-compose` 文件、`.github/workflows/` 文件、`.env*` 文件、任何已有测试文件

## Example test file

```python
"""API tests for /api/contact endpoint."""

import allure
import pytest


@allure.feature("Contact")
@allure.story("Validation")
class TestContact:

    @pytest.mark.smoke
    def test_missing_fields_returns_400(self, client):
        resp = client.post("/api/contact", json={})
        assert resp.status_code == 400

    def test_without_turnstile_token_rejected(self, client):
        resp = client.post("/api/contact", json={
            "name": "Test", "message": "Hello", "turnstileToken": "",
        })
        assert resp.status_code in (400, 403)

    def test_message_too_long_returns_400(self, client):
        resp = client.post("/api/contact", json={
            "name": "Test",
            "message": "x" * 10001,
            "turnstileToken": "fake",
        })
        assert resp.status_code == 400
```

---

## Coverage Gaps Report

{COVERAGE_GAPS_CONTENT}
