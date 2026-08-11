-- DatabaseBackend 专用索引迁移
-- 优化 findOneBySkillName / findMetadataByApp / getAccessQuery 的查询性能

-- 1. (app_ref, skill_name) 复合索引
--    用于 findOneBySkillName: WHERE app_ref = ? AND skill_name = ?
--    这是 read / write / ls/<name> 最频繁的查询路径，缺少此索引会导致顺序扫描
CREATE INDEX IF NOT EXISTS "documents_app_ref_skill_name_idx"
  ON "lc"."documents" ("app_ref", "skill_name");

-- 2. (app_ref, title) 复合索引
--    用于 findOneBySkillName 的 title 回退: WHERE app_ref = ? AND title = ?
--    当文档未设置 skill_name 时，系统以 title 作为文档名进行匹配
CREATE INDEX IF NOT EXISTS "documents_app_ref_title_idx"
  ON "lc"."documents" ("app_ref", "title");

-- 3. shares 字段 GIN 索引
--    用于 getAccessQuery: shares @> '[{"targetType":"ALL"}]'::jsonb
--    每次权限过滤调用（getAccessFilter）都会用到此 JSONB 包含查询
--    GIN 索引是 PostgreSQL 对 JSONB @> 操作符的最优选择
CREATE INDEX IF NOT EXISTS "documents_shares_gin_idx"
  ON "lc"."documents" USING gin ("shares");
