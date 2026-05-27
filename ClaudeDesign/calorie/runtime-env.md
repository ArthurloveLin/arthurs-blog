# Runtime Env Notes

## 必需环境变量

- `AGY_BIN`
  - 默认值：`/home/arthur/.local/bin/agy`
  - 用途：agy 可执行文件路径
- `AGY_UPLOAD_ROOT`
  - 默认值：`/tmp/arthurs-blog/agent-uploads`
  - 用途：运行时附件物化目录
- `AGY_HOME_ROOT`
  - 默认值：`/tmp/arthurs-blog/agent-home`
  - 用途：为 agy 提供隔离的 HOME 根目录
- `AGY_TIMEOUT_MS`
  - 默认值：`120000`
  - 用途：单次 agy 运行超时
- `AGY_MAX_CONCURRENCY`
  - 默认值：`1`
  - 用途：控制并发上限
- `CALORIE_DB_JSON_PATH`
  - 默认值：`/home/arthur/repositories/arthurs-blog/ClaudeDesign/calorie/calorie-db.json`
  - 用途：热量知识库 JSON 资产路径

## 本轮 smoke test 结论

- 已验证：将图片复制到 `AGY_UPLOAD_ROOT` 指向的目录并通过 `--add-dir` 暴露给 agy 是可执行的测试路径。
- 已验证：当使用全新隔离 HOME 时，agy 会要求重新做 Google 登录，因此“多并发完全隔离 HOME”在生产前必须先解决认证引导或凭据预热。
- 未证实：在当前会话里 agy 是否已经稳定返回图片识别结果。默认 HOME 下命令未在本轮观察窗口内返回可判定输出，因此图片链路暂时只能标记为“认证门槛已识别，识图结果待二次验证”。

## 当前建议

1. 开发环境先允许使用默认 HOME 或预热过认证状态的共享 HOME，优先验证图片读取与结构化输出。
2. 生产前再补“隔离 HOME 的认证 bootstrap”方案，否则无法安全落地多并发沙箱。
3. 所有 agy 相关接口固定为 Node runtime，不部署到 edge。