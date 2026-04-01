-- Phase 5: 多维评分（颜值 / 实用 / 性价比）
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS appearance_score numeric(2,1) CHECK (appearance_score >= 1 AND appearance_score <= 5);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS practicality_score numeric(2,1) CHECK (practicality_score >= 1 AND practicality_score <= 5);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS value_score numeric(2,1) CHECK (value_score >= 1 AND value_score <= 5);
