-- ============================================
-- 修改餐食计划表，支持一个计划包含多个食谱（不使用中间表）
-- ============================================

-- 1. 在 meal_plans 表中添加 recipe_ids 字段（JSON类型，存储多个食谱ID）
ALTER TABLE `meal_plans`
ADD COLUMN `recipe_ids` JSON DEFAULT NULL AFTER `meal_slot`;

-- 2. 迁移现有数据（如果有）
-- 将 recipes.plan_id 关联的食谱ID迁移到 meal_plans.recipe_ids
UPDATE `meal_plans` mp
SET `recipe_ids` = (
    SELECT JSON_ARRAYAGG(r.recipe_id)
    FROM `recipes` r
    WHERE r.plan_id = mp.plan_id
)
WHERE EXISTS (
    SELECT 1 FROM `recipes` r WHERE r.plan_id = mp.plan_id
);

-- 3. 可选：移除 recipes 表中的 plan_id 字段（如果不再需要）
-- 注意：先确保数据已迁移完成
-- ALTER TABLE `recipes` DROP FOREIGN KEY `fk_recipes_meal_plan`;
-- ALTER TABLE `recipes` DROP COLUMN `plan_id`;

-- ============================================
-- 说明
-- ============================================
-- 新的设计：
-- - meal_plans.recipe_ids: JSON数组，存储多个食谱ID，例如 [1, 2, 3]
-- - 一个餐食计划可以包含多个食谱
-- - 一个食谱可以添加到多个餐食计划（通过在不同计划的recipe_ids中包含该食谱ID）
-- 
-- 优势：
-- - 不需要中间表
-- - 使用现有表结构
-- - 简单直接
-- 
-- 注意：
-- - recipe_ids 字段是 JSON 类型，可以存储数组
-- - 查询时使用 JSON 函数来操作

