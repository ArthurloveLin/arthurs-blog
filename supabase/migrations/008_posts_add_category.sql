-- 为文章表新增 category 字段（改动项 1：分类系统）
ALTER TABLE posts
  ADD COLUMN category TEXT DEFAULT NULL;
