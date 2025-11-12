# ZeoWaste Database Review

## Overview
This is a review of the `zeowaste_db` database schema for the ZeoWaste food waste management application.

## Database Structure Analysis

### Tables Overview
1. **users** - User accounts and authentication
2. **fooditems** - Food inventory items
3. **recipes** - Recipe storage with ingredients and nutrition
4. **donations** - Food donation tracking
5. **bookmarked_foods** - User bookmarks for food items

---

## Issues Found

### 1. **Data Type Inconsistencies**

#### Issue: `fooditems.user_id` vs `recipes.user_id`
- `fooditems.user_id` is `int(11)` (signed integer)
- `recipes.user_id` is `int(11)` (signed integer)
- `users.user_id` is `int(11)` (signed integer) with AUTO_INCREMENT starting at 16
- **Recommendation**: All user_id fields should be consistent. Consider using `BIGINT UNSIGNED` for better scalability.

#### Issue: `bookmarked_foods.user_id`
- `bookmarked_foods.user_id` is `bigint(20) UNSIGNED` but references `users.user_id` which is `int(11)`
- This is a **foreign key type mismatch** that could cause issues
- **Recommendation**: Either change `bookmarked_foods.user_id` to `int(11)` or change `users.user_id` to `bigint(20) UNSIGNED`

### 2. **Missing Foreign Key Constraints**

#### Issue: `bookmarked_foods.user_id`
- The table has a foreign key on `food_id` but **no foreign key constraint on `user_id`**
- This could lead to orphaned records if users are deleted
- **Recommendation**: Add foreign key constraint:
  ```sql
  ALTER TABLE `bookmarked_foods`
  ADD CONSTRAINT `fk_bookmarked_user` 
  FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) 
  ON DELETE CASCADE;
  ```

### 3. **Index Optimization**

#### Issue: Missing Composite Indexes
- `bookmarked_foods` table queries by `user_id` and `food_id` together frequently
- **Recommendation**: Add composite index:
  ```sql
  CREATE INDEX `idx_user_food` ON `bookmarked_foods` (`user_id`, `food_id`);
  ```

#### Issue: `donations` table
- Queries likely filter by `donation_status` and `created_at`
- **Recommendation**: Add composite index:
  ```sql
  CREATE INDEX `idx_status_created` ON `donations` (`donation_status`, `created_at`);
  ```

### 4. **Data Integrity Issues**

#### Issue: Redundant Data in `fooditems`
- `fooditems` table has `donation_pickup_location` and `donation_availability` fields
- These are also stored in the `donations` table
- This creates data duplication and potential inconsistency
- **Recommendation**: Remove these fields from `fooditems` table and always reference `donations` table

#### Issue: `fooditems.food_status` enum
- Current values: `'active','donated','completed'`
- But the code in `FetchFoodItem.php` treats `'donated'` separately
- **Recommendation**: Consider if `'donated'` status is needed in `fooditems` or if it should be determined by the existence of a record in `donations` table

### 5. **JSON Field Validation**

#### Issue: `recipes` table JSON fields
- `nutrition`, `ingredients`, and `food_ids` use JSON type with CHECK constraints
- These constraints may not be properly enforced in older MariaDB versions
- **Recommendation**: Add application-level validation in PHP code

### 6. **Default Values**

#### Issue: `bookmarked_foods.user_id`
- Default value is `1`, but this might not be a valid user
- **Recommendation**: Remove default value or ensure user_id 1 exists

### 7. **Timestamp Fields**

#### Issue: Inconsistent timestamp usage
- `users.created_at` uses `timestamp` type
- `fooditems.created_at` uses `datetime` type
- `recipes.created_at` uses `timestamp` type
- **Recommendation**: Standardize on `datetime` type for consistency and to avoid timezone issues

---

## Recommendations

### High Priority

1. **Fix Foreign Key Type Mismatch**
   - Align `bookmarked_foods.user_id` with `users.user_id` data type
   - Add missing foreign key constraint on `bookmarked_foods.user_id`

2. **Remove Data Duplication**
   - Remove `donation_pickup_location` and `donation_availability` from `fooditems` table
   - Always reference `donations` table for donation information

3. **Add Missing Indexes**
   - Composite index on `bookmarked_foods(user_id, food_id)`
   - Composite index on `donations(donation_status, created_at)`

### Medium Priority

4. **Standardize Data Types**
   - Consider using `BIGINT UNSIGNED` for all ID fields for better scalability
   - Standardize timestamp fields to `datetime`

5. **Improve Status Management**
   - Review the relationship between `fooditems.food_status` and `donations.donation_status`
   - Consider using a state machine or status history table

### Low Priority

6. **Add Audit Fields**
   - Consider adding `updated_at` to `users` and `recipes` tables
   - Add `created_by` and `updated_by` fields for tracking changes

7. **Add Soft Deletes**
   - Consider adding `deleted_at` timestamp for soft delete functionality
   - This is partially implemented in `bookmarked_foods.status` but could be extended

---

## SQL Migration Scripts

### Fix 1: Add Missing Foreign Key Constraint
```sql
ALTER TABLE `bookmarked_foods`
ADD CONSTRAINT `fk_bookmarked_user` 
FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) 
ON DELETE CASCADE;
```

### Fix 2: Add Composite Indexes
```sql
CREATE INDEX `idx_user_food` ON `bookmarked_foods` (`user_id`, `food_id`);
CREATE INDEX `idx_status_created` ON `donations` (`donation_status`, `created_at`);
```

### Fix 3: Fix Data Type Consistency (if changing to INT)
```sql
ALTER TABLE `bookmarked_foods`
MODIFY `user_id` INT(11) NOT NULL;
```

### Fix 4: Remove Redundant Fields (after code update)
```sql
ALTER TABLE `fooditems`
DROP COLUMN `donation_pickup_location`,
DROP COLUMN `donation_availability`;
```

---

## Security Considerations

1. **Password Storage**: ✅ Using `$2y$10$` bcrypt hashing - Good!
2. **SQL Injection**: ✅ Using prepared statements in PHP code - Good!
3. **Session Management**: ✅ Using sessions for authentication - Good!

---

## Performance Considerations

1. **Indexes**: Most critical indexes are present, but composite indexes could improve query performance
2. **JSON Fields**: JSON queries can be slow - consider if normalized tables would be better for `recipes.ingredients`
3. **Foreign Keys**: All foreign keys have proper indexes - Good!

---

## Summary

The database structure is generally well-designed with good use of:
- Foreign key constraints
- Indexes on key fields
- Enum types for status fields
- Proper normalization

Main areas for improvement:
1. Fix foreign key type mismatches
2. Remove data duplication
3. Add composite indexes for common query patterns
4. Standardize data types across tables

