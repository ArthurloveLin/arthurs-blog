-- 016_dynamic_templates.sql
-- 为 sessions 增加模板支持 & 为 ratings 增加灵活评分字段

-- 1. 扩展 sessions 表
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS template_id text DEFAULT 'wardrobe';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS template_config jsonb;

-- 2. 扩展 ratings 表以支持动态维度
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS scores jsonb;

-- 3. 数据平滑迁移：将旧有的三维评分合并到 scores JSONB 中
UPDATE ratings 
SET scores = jsonb_build_object(
  'appearance_score', COALESCE(appearance_score, 0),
  'practicality_score', COALESCE(practicality_score, 0),
  'value_score', COALESCE(value_score, 0)
)
WHERE scores IS NULL 
  AND (appearance_score IS NOT NULL OR practicality_score IS NOT NULL OR value_score IS NOT NULL);

-- 4. (可选) 给旧 Session 补全默认模板配置
-- 衣服评价维度：颜值、实用、性价比
UPDATE sessions
SET template_config = '{
  "name": "衣评",
  "itemLabel": "衣服",
  "dimensions": [
    {"key": "appearance_score", "label": "颜值", "color": "#f472b6"},
    {"key": "practicality_score", "label": "实用", "color": "#60a5fa"},
    {"key": "value_score", "label": "性价比", "color": "#34d399"}
  ]
}'::jsonb
WHERE template_config IS NULL;
