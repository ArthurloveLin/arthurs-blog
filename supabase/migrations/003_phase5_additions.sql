-- Phase 5 additions

-- 单品备注（品牌、店铺链接等）
ALTER TABLE items ADD COLUMN IF NOT EXISTS notes text;
