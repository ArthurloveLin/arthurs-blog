# Issue 001：Supabase 登录报 Failed to fetch

## 问题描述

在登录页面输入账号密码后，报错 `Failed to fetch`，无法完成登录。

```
TypeError: Failed to fetch
  at handleSubmit (app/auth/login/page.tsx:24:54)
```

## 根因分析

### 环境配置

`.env.local` 中 Supabase 使用了自定义域名：

```
NEXT_PUBLIC_SUPABASE_URL=https://api.arthurlovegrace.top
```

该域名通过 Cloudflare 透传，但**没有正确代理到 Supabase 原始地址**，导致浏览器直接请求该域名时连接失败。

### 为什么之前的功能没有问题？

之前所有 Supabase 操作都经过 Next.js API Route，浏览器从未直接接触 Supabase URL。

**正常路径（items / sessions 等功能）：**
```
浏览器
  └─ fetch /api/items（Next.js API Route，服务端执行）
       └─ supabase-server.ts
            └─ api.arthurlovegrace.top（服务端 → Supabase，服务器间请求，正常）
```

**出错路径（登录页）：**
```
浏览器
  └─ supabase.auth.signInWithPassword()（'use client' 组件，浏览器执行）
       └─ fetch api.arthurlovegrace.top/auth/v1/token（浏览器 → 自定义域名，失败）
```

登录是第一个在**浏览器侧**直接调用 Supabase 的功能，所以第一次暴露了这个问题。

## 解决方案

将登录/注册改为 **Server Action**，让 Supabase 调用回归服务端，与其他功能保持一致。

### 修改后的调用链

**登录：**
```
浏览器
  └─ form action → Server Action login()（服务端执行）
       └─ supabase-server.ts
            └─ api.arthurlovegrace.top/auth/v1/token（服务端 → Supabase，正常）
                 └─ 成功 → redirect()
```

**注册：**
```
浏览器
  └─ form action → Server Action register()（服务端执行）
       └─ supabase-server.ts
            └─ api.arthurlovegrace.top/auth/v1/signup（服务端 → Supabase，正常）
                 └─ 成功 → redirect()
```

### 新增文件

- `app/auth/login/actions.ts` — 登录 Server Action
- `app/auth/register/actions.ts` — 注册 Server Action

### 页面改动

| 文件 | 变化 |
|---|---|
| `app/auth/login/page.tsx` | 移除 `supabase-client` 调用，改用 `useActionState` + Server Action |
| `app/auth/register/page.tsx` | 同上 |

## 结论

> 在 Next.js App Router 中，所有直接调用 Supabase 的操作应在服务端执行（API Route 或 Server Action）。`'use client'` 组件不应直接使用 Supabase 客户端，除非 Supabase 的自定义域名已正确配置了反向代理。
