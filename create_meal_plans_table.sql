-- ============================================
-- 创建 meal_plans 表用于每周餐食计划
-- ============================================

CREATE TABLE `meal_plans` (
  `plan_id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `meal_date` DATE NOT NULL,
  `meal_slot` ENUM('Breakfast', 'Lunch', 'Dinner', 'Snacks') NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`plan_id`),
  KEY `idx_user_date` (`user_id`, `meal_date`),
  KEY `idx_user_date_slot` (`user_id`, `meal_date`, `meal_slot`),
  CONSTRAINT `fk_meal_plans_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  -- 确保同一用户、同一日期、同一餐时段只有一个计划
  UNIQUE KEY `unique_user_date_slot` (`user_id`, `meal_date`, `meal_slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 在 recipes 表中添加 plan_id 外键
-- ============================================

ALTER TABLE `recipes`
ADD COLUMN `plan_id` BIGINT(20) UNSIGNED DEFAULT NULL AFTER `recipe_id`,
ADD KEY `idx_plan` (`plan_id`),
ADD CONSTRAINT `fk_recipes_meal_plan` 
  FOREIGN KEY (`plan_id`) REFERENCES `meal_plans` (`plan_id`) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- ============================================
-- 表结构说明
-- ============================================
-- meal_plans 表：
-- - plan_id: 计划ID（主键）
-- - user_id: 用户ID（外键关联到users表）
-- - meal_date: 用餐日期（DATE类型）
-- - meal_slot: 餐时段（Breakfast早餐, Lunch午餐, Dinner晚餐, Snacks零食）
-- - created_at: 创建时间
-- - updated_at: 更新时间
-- 
-- recipes 表新增字段：
-- - plan_id: 餐食计划ID（外键关联到meal_plans表，可为NULL）
-- 
-- 索引：
-- - idx_user_date: 用于快速查询用户某日期的所有计划
-- - idx_user_date_slot: 用于快速查询用户特定日期和餐时段的计划
-- - idx_plan: 用于快速查询属于某个计划的食谱
-- 
-- 约束：
-- - unique_user_date_slot: 确保同一用户、同一日期、同一餐时段只能有一个计划
-- - fk_meal_plans_user: 用户删除时，自动删除该用户的所有计划
-- - fk_recipes_meal_plan: 计划删除时，将相关食谱的plan_id设为NULL（不删除食谱）

