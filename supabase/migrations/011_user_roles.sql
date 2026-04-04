-- 011_user_roles.sql
-- Phase 1: User roles and guest sessions

-- 用户角色表
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- 游客会话表（备用，核心数据存客户端）
CREATE TABLE IF NOT EXISTS guest_sessions (
  guest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 为管理员账号手动插入 admin 记录
-- 注意：需要先在 Supabase Auth 控制台创建 arthur@arthurlovegrace.top 和 grace@arthurlovegrace.top 账号
-- 创建账号后执行以下语句（替换实际 user_id）：
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email IN ('arthur071684@outlook.com', '1370316384@qq.com')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
