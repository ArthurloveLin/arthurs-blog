  在自动化脚本或 API 接口中，必须使用以下命令行组合来调用  agy ：

    # 核心命令格式
    /home/arthur/.local/bin/agy \
      --dangerously-skip-permissions \
      --print \
      -p "你的 Prompt 指令"
  •  --dangerously-skip-permissions （最关键）：自动批准所有工具执行权限（如文件读写、指令运行）。如果不加此参数， agy  会在终端挂起，等待人工确认（Yes/No），导致 API
  永远超时。
  •  --print  (或  -p )：开启非交互模式，Agent 执行完任务后会直接输出并退出进程。
  •  --add-dir <path> （可选）：如果需要 Agent 修改指定目录的文件，用它限制 Agent 的写操作范围（如  --add-dir ./src ），防止它扫描无关文件导致初始化缓慢（Brain
  Bloat）。
  ──────
  ### 2. 状态与并发隔离
   agy  默认将对话记忆和缓存写入  ~/.gemini/antigravity-cli/brain/  目录。如果多个 API 请求并发调用，会导致“大脑状态”互相覆盖、冲突报错。

  解决方案：

  • 单并发串行：如果不需要并发，在每次调用  agy  之前，先强制清理历史状态：
    rm -rf ~/.gemini/antigravity-cli/brain/ 2>/dev/null || true
  • 多并发隔离（推荐）：通过为每个 API 进程指定独立的临时  HOME  目录，来实现完全沙箱隔离：
    # 为当前调用生成独立的临时 HOME 目录，隔离缓存
    export HOME=/tmp/agy_sandbox_$(date +%s%N)
    mkdir -p $HOME

    /home/arthur/.local/bin/agy --dangerously-skip-permissions --print -p "Prompt"

    # 调用结束后销毁临时目录
    rm -rf $HOME

  ──────
  ### 3. 封装为一个极简的 HTTP API 服务 (Python FastAPI 示例)

  在宿主机后台启动一个轻量级的 Python FastAPI 或是 Node.js 服务。通过队列 (Queue) 或 信号量 (Semaphore) 保证  agy  串行/受控运行，并捕获输出返回。


     agy  确实可以通过两种非常灵活的方式来接收和访问指定的路径：
  ### 1.  agy  如何识别它的“工作目录”？

   agy  默认将**当前进程运行的目录（CWD，Current Working Directory）**作为主工作区。因此在 API
  中，你只需要设置子进程的  cwd  属性，就可以把任意目录指定为它的工作区。
  ──────
  ### 2. 使用一个专用路径存上传图片（最简方案）

  如果你不想每次都拷贝图片，只想在服务器上设一个固定的图片上传目录（例如  /home/arthur/uploads/
  ），可以直接这样做：

  1. 上传图片：将所有图片统一存在  /home/arthur/uploads/  目录下（例如
  /home/arthur/uploads/user_123.png ）。
  2. 启动参数增加  --add-dir ：把该专用目录作为额外工作区挂载给  agy 。
  3. Prompt 传入绝对路径：直接在 Prompt 中告诉 Agent 去读该绝对路径。

  #### 命令行调用示例：

    /home/arthur/.local/bin/agy \
      --add-dir /home/arthur/uploads/ \
      --dangerously-skip-permissions \
      --print \
      -p "分析这个路径下的图片内容：/home/arthur/uploads/user_123.png"

  •  --add-dir /home/arthur/uploads/ ：告诉  agy
  这个目录是合法的，它会自动将其加入文件系统的安全访问白名单。
  •  --dangerously-skip-permissions ：自动批准对该目录的读取请求。
  ──────
  ### 3. API 服务改写示例（基于专用图片路径）

  如果你采用这种模式，API 包装服务将变得更加简单，因为不需要每次创建临时工作区和拷贝文件：