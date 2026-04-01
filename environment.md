## Phase 0 详细环境搭建流程

---

### 前置条件确认

先确认本地已有：
- Node.js ≥ 18（`node -v` 检查）
- Git（`git --version` 检查）
- 一个 GitHub 账号
- 一个 Vercel 账号（用 GitHub 登录即可）
- 一个 Supabase 账号（免费注册 supabase.com）

---

### 第一步：初始化 Next.js 项目

```bash
npx create-next-app@latest wardrobe-picks
```

交互选项按如下选择：

```
✔ Would you like to use TypeScript? → Yes
✔ Would you like to use ESLint? → Yes
✔ Would you like to use Tailwind CSS? → Yes
✔ Would you like to use `src/` directory? → No
✔ Would you like to use App Router? → Yes
✔ Would you like to customize the default import alias? → No
```

然后进入项目目录：

```bash
cd wardrobe-picks
```

---

### 第二步：安装依赖

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install browser-image-compression
npm install uuid
npm install -D @types/uuid
```

说明：
- `@supabase/supabase-js` — Supabase 核心客户端
- `@supabase/ssr` — 在 Next.js Server Component / API Route 中使用 Supabase 的官方适配层
- `browser-image-compression` — 客户端图片压缩，比 `sharp`（服务端）更适合这个场景，压缩在用户浏览器本地完成，不消耗服务器资源
- `uuid` — 生成会话 token

---

### 第三步：创建 Supabase 项目

1. 登录 [supabase.com](https://supabase.com)，点击 **New Project**
2. 填写：
   - Project name：`wardrobe-picks`
   - Database Password：设一个强密码，**保存好**（后面不再显示）
   - Region：选 **Northeast Asia (Tokyo)** —— 你在东京，延迟最低
3. 点击 **Create new project**，等待约 1 分钟初始化完成

初始化完成后，进入项目，点击左侧 **Project Settings → API**，记下以下三个值（后面要用）：

```
Project URL:        https://xxxxxxxxxxxx.supabase.co
anon public key:    eyJhbGc...（很长的 JWT）
service_role key:   eyJhbGc...（另一个很长的 JWT，保密！）
```

---

### 第四步：创建数据库表

在 Supabase 控制台，点击左侧 **SQL Editor**，新建一个查询，粘贴以下 SQL 并点击 **Run**：

```sql
-- 会话表
CREATE TABLE sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text,
  note       text,
  token      text UNIQUE NOT NULL,
  budget     integer,
  created_at timestamptz DEFAULT now()
);

-- 衣服条目表
CREATE TABLE items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid REFERENCES sessions(id) ON DELETE CASCADE,
  image_url   text NOT NULL,
  image_path  text NOT NULL,
  position    integer DEFAULT 0,
  decision    text CHECK (decision IN ('buy','skip','pending')) DEFAULT 'pending',
  created_at  timestamptz DEFAULT now()
);

-- 评分表
CREATE TABLE ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid REFERENCES items(id) ON DELETE CASCADE,
  author     text NOT NULL,
  score      numeric(2,1) CHECK (score >= 1 AND score <= 5),
  created_at timestamptz DEFAULT now(),
  UNIQUE(item_id, author)
);

-- 评论表
CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid REFERENCES items(id) ON DELETE CASCADE,
  author     text NOT NULL,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

运行后在左侧 **Table Editor** 能看到四张表就说明成功了。

---

### 第五步：创建 Storage Bucket

在 Supabase 控制台，点击左侧 **Storage → New bucket**：

- Bucket name：`wardrobe`
- Public bucket：**勾选**（图片要能通过 URL 直接访问）
- 点击 **Create bucket**

然后需要添加一条 Storage Policy，允许所有人上传（因为不做登录）。点击刚创建的 `wardrobe` bucket → **Policies → New Policy → For full customization**：

```sql
-- Policy name: allow_all（临时策略，项目成熟后可收紧）
-- Allowed operations: SELECT, INSERT, DELETE

(bucket_id = 'wardrobe')
```

或者更简单：直接在 **Policies** 里选 **Enable read access for everyone** 和 **Enable insert access for everyone** 两个模板分别创建即可。

---

### 第六步：配置本地环境变量

在项目根目录创建 `.env.local`：

```bash
touch .env.local
```

填入以下内容（替换为你的真实值）：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

注意区别：
- `NEXT_PUBLIC_` 前缀的变量会暴露给浏览器，anon key 是设计上公开的，没问题
- `SERVICE_ROLE_KEY` **不加** `NEXT_PUBLIC_` 前缀，只在服务端 API Route 中使用，绝对不能泄漏

然后把 `.env.local` 加入 `.gitignore`（`create-next-app` 默认已经加了，确认一下）：

```bash
grep ".env.local" .gitignore   # 应该能看到这一行
```

---

### 第七步：创建 Supabase 客户端工具文件

在项目中创建 `lib/supabase.ts`：

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 客户端用（浏览器）
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 服务端用（API Route），拥有完整权限
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
```

---

### 第八步：验证连通性

在 `app/page.tsx` 临时加一段测试代码，跑通后再删掉：

```typescript
import { supabaseAdmin } from '@/lib/supabase'

export default async function Home() {
  const { data, error } = await supabaseAdmin.from('sessions').select('*')
  
  return (
    <main>
      <p>连接测试：{error ? '失败 ❌ ' + error.message : '成功 ✅'}</p>
      <p>会话数量：{data?.length ?? 0}</p>
    </main>
  )
}
```

启动开发服务器：

```bash
npm run dev
```

打开 `http://localhost:3000`，看到「连接测试：成功 ✅」说明数据库连通。

---

### 第九步：推送到 GitHub

```bash
git init         # create-next-app 已经初始化过，这步可跳过
git add .
git commit -m "chore: phase 0 init"
```

在 GitHub 创建一个新仓库（不要勾选 Initialize with README），然后：

```bash
git remote add origin https://github.com/你的用户名/wardrobe-picks.git
git branch -M main
git push -u origin main
```

---

### 第十步：部署到 Vercel

1. 登录 [vercel.com](https://vercel.com)，点击 **Add New Project**
2. 选择刚推送的 `wardrobe-picks` 仓库，点击 **Import**
3. Framework 自动检测为 Next.js，不用改
4. 展开 **Environment Variables**，添加三条：
   ```
   NEXT_PUBLIC_SUPABASE_URL        = https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY       = eyJhbGc...
   ```
5. 点击 **Deploy**，等待约 1-2 分钟

部署完成后，Vercel 会给你一个 `https://wardrobe-picks-xxx.vercel.app` 的域名。打开它，看到和本地一样的「连接测试：成功 ✅」说明 Phase 0 全部完成。

---

### 完成检查清单

```
✅ Next.js 项目本地可以 npm run dev 跑起来
✅ Supabase 四张表已创建
✅ Storage wardrobe bucket 已创建且为 public
✅ 本地 .env.local 配置完毕
✅ localhost:3000 显示「连接测试：成功」
✅ 代码已推送 GitHub
✅ Vercel 部署成功，线上也显示「连接测试：成功」
```

全部打钩之后，把测试代码删掉，`git push`，然后告诉 Claude Code「Phase 0 已完成，开始 Phase 1」就可以了。