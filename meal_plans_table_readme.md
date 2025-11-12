# Meal Plans Table 使用说明

## 概述
`meal_plans` 表用于存储用户的每周餐食计划，可以将食谱分配到特定的日期和餐时段。

## 数据库表结构

### 表名：`meal_plans`

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `plan_id` | BIGINT(20) UNSIGNED | 主键，自动递增 |
| `user_id` | INT(11) | 用户ID（外键关联到users表） |
| `recipe_id` | BIGINT(20) UNSIGNED | 食谱ID（外键关联到recipes表） |
| `meal_date` | DATE | 用餐日期 |
| `meal_slot` | ENUM | 餐时段：'Breakfast', 'Lunch', 'Dinner', 'Snacks' |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 更新时间 |

### 约束和索引

1. **主键**: `plan_id`
2. **唯一约束**: `unique_user_date_slot` - 确保同一用户、同一日期、同一餐时段只能有一个食谱
3. **外键约束**:
   - `fk_meal_plans_user` - 关联到 `users.user_id`，删除用户时自动删除该用户的所有计划
   - `fk_meal_plans_recipe` - 关联到 `recipes.recipe_id`，删除食谱时自动删除使用该食谱的所有计划
4. **索引**:
   - `idx_user_date` - 用于快速查询用户某日期的所有计划
   - `idx_user_date_slot` - 用于快速查询用户特定日期和餐时段的计划
   - `idx_recipe` - 用于快速查询使用某个食谱的计划

## API 使用说明

### 1. 添加餐食计划

**端点**: `WeelyMealPlanner/meal_plans_api.php`

**方法**: POST

**Action**: `add_meal_plan`

**请求体**:
```json
{
  "recipe_id": 1,
  "meal_date": "2025-11-12",
  "meal_slot": "Lunch"
}
```

**响应**:
```json
{
  "ok": true,
  "data": {
    "plan_id": 1
  }
}
```

**说明**: 
- 如果该用户、日期、餐时段已存在计划，会自动更新为新的食谱
- `meal_slot` 必须是: `Breakfast`, `Lunch`, `Dinner`, `Snacks` 之一
- `meal_date` 格式必须是 `YYYY-MM-DD`

### 2. 获取餐食计划

**端点**: `WeelyMealPlanner/meal_plans_api.php`

**方法**: GET

**Action**: `get_meal_plans`

**查询参数**:
- `start_date` (可选): 开始日期，格式 `YYYY-MM-DD`
- `end_date` (可选): 结束日期，格式 `YYYY-MM-DD`

**示例**:
```
GET WeelyMealPlanner/meal_plans_api.php?action=get_meal_plans&start_date=2025-11-12&end_date=2025-11-18
```

**响应**:
```json
{
  "ok": true,
  "data": [
    {
      "plan_id": 1,
      "recipe_id": 1,
      "meal_date": "2025-11-12",
      "meal_slot": "Lunch",
      "recipe_name": "Salad",
      "recipe_category": "LUNCH",
      "nutrition": {
        "calories": "12",
        "protein_g": "10",
        "fat_g": "30",
        "carbs_g": "30"
      },
      "ingredients": [
        {
          "name": "vegetables",
          "amount": "100g",
          "pos": 1
        }
      ]
    }
  ]
}
```

**说明**: 
- 如果不提供日期范围，默认返回最近7天的计划
- 结果按日期和餐时段排序

### 3. 获取指定周的计划

**端点**: `WeelyMealPlanner/meal_plans_api.php`

**方法**: GET

**Action**: `get_week_plans`

**查询参数**:
- `week_start` (可选): 周一的日期，格式 `YYYY-MM-DD`。如果不提供，默认使用本周一

**示例**:
```
GET WeelyMealPlanner/meal_plans_api.php?action=get_week_plans&week_start=2025-11-12
```

**响应**: 与 `get_meal_plans` 相同

**说明**: 
- 自动计算一周的日期范围（周一到周日）
- 返回该周的所有计划

### 4. 删除餐食计划

**端点**: `WeelyMealPlanner/meal_plans_api.php`

**方法**: POST 或 GET

**Action**: `remove_meal_plan`

**请求体** (POST) 或查询参数 (GET):
```json
{
  "plan_id": 1
}
```
或
```json
{
  "meal_date": "2025-11-12",
  "meal_slot": "Lunch"
}
```

**响应**:
```json
{
  "ok": true,
  "data": {
    "deleted": 1
  }
}
```

**说明**: 
- 可以通过 `plan_id` 删除，也可以通过 `meal_date` 和 `meal_slot` 删除
- 只能删除当前用户的计划

### 5. 批量添加餐食计划

**端点**: `WeelyMealPlanner/meal_plans_api.php`

**方法**: POST

**Action**: `batch_add_meal_plans`

**请求体**:
```json
{
  "plans": [
    {
      "recipe_id": 1,
      "meal_date": "2025-11-12",
      "meal_slot": "Breakfast"
    },
    {
      "recipe_id": 2,
      "meal_date": "2025-11-12",
      "meal_slot": "Lunch"
    }
  ]
}
```

**响应**:
```json
{
  "ok": true,
  "data": {
    "added": 2
  }
}
```

**说明**: 
- 使用事务处理，如果任何一个计划添加失败，所有操作都会回滚
- 如果计划已存在，会自动更新

## 在前端 JavaScript 中使用

### 添加餐食计划

```javascript
async function addMealPlan(recipeId, mealDate, mealSlot) {
    try {
        const response = await fetch('WeelyMealPlanner/meal_plans_api.php?action=add_meal_plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipe_id: recipeId,
                meal_date: mealDate,
                meal_slot: mealSlot
            })
        });
        const data = await response.json();
        if (data.ok) {
            console.log('Meal plan added:', data.data);
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to add meal plan');
        }
    } catch (error) {
        console.error('Error adding meal plan:', error);
        throw error;
    }
}
```

### 获取周计划

```javascript
async function getWeekPlans(weekStart) {
    try {
        const url = `WeelyMealPlanner/meal_plans_api.php?action=get_week_plans&week_start=${weekStart}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.ok) {
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to get week plans');
        }
    } catch (error) {
        console.error('Error getting week plans:', error);
        throw error;
    }
}
```

### 删除餐食计划

```javascript
async function removeMealPlan(mealDate, mealSlot) {
    try {
        const response = await fetch('WeelyMealPlanner/meal_plans_api.php?action=remove_meal_plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                meal_date: mealDate,
                meal_slot: mealSlot
            })
        });
        const data = await response.json();
        if (data.ok) {
            console.log('Meal plan removed');
            return true;
        } else {
            throw new Error(data.error || 'Failed to remove meal plan');
        }
    } catch (error) {
        console.error('Error removing meal plan:', error);
        throw error;
    }
}
```

## 安装步骤

1. **创建数据库表**:
   ```bash
   # 在 phpMyAdmin 中执行 create_meal_plans_table.sql 文件
   # 或者使用命令行：
   mysql -u root -p zeowaste_db < create_meal_plans_table.sql
   ```

2. **验证表结构**:
   ```sql
   DESCRIBE meal_plans;
   SHOW INDEX FROM meal_plans;
   ```

3. **测试 API**:
   - 确保用户已登录（有有效的 session）
   - 使用 Postman 或浏览器测试各个 API 端点

## 注意事项

1. **用户认证**: 所有 API 都需要用户登录（通过 session）
2. **数据验证**: API 会验证日期格式、餐时段值等
3. **唯一性**: 同一用户、同一日期、同一餐时段只能有一个食谱
4. **级联删除**: 删除用户或食谱时，相关的餐食计划会自动删除
5. **日期格式**: 所有日期必须使用 `YYYY-MM-DD` 格式

## 与现有代码集成

在 `meal_planner.js` 中，可以将现有的占位符代码替换为实际的 API 调用：

```javascript
// 在 setupModal 函数中
const addBtn = q('#mm-add');
if (addBtn) {
    addBtn.addEventListener('click', async () => {
        const recipeId = editingRecipeId; // 从详情模态框中获取
        const mealDate = q('#mm-date').value;
        const mealSlot = q('#mm-slot').value;
        
        try {
            await addMealPlan(recipeId, mealDate, mealSlot);
            closeModal();
            // 重新加载周计划
            await loadWeekPlans();
        } catch (error) {
            alert('Failed to add meal plan: ' + error.message);
        }
    });
}
```

