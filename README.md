# Personalized Nutrition & Recipe Tracker

**DBMS Experiential Learning – Level 3**  
**Course:** Database Management Systems  
**Instructor:** Prof. Deena Hajim  
**Section:** A  
**Team Members:**  
- **Adarsh Prakash** (PES2UG24CS027)  
- **Abhirama H Y** (PES2UG24CS023)  

---

## 1. Project Overview & Architecture

The **Personalized Nutrition & Recipe Tracker** is a production-grade, full-stack hybrid database application. It bridges the gap between strictly structured transactional relational data and variable-structure polymorphic document data:

1. **Transactional Core (MySQL 8.0):** Normalized 3NF tables managing user identities, bcrypt-hashed credentials, physical body metrics, dietary profiles, temporal nutrition goals, daily nutrition logs, and meal log entries. Triggers guarantee non-overlapping date ranges, prevent orphaned records, block inactive recipe logging, and automatically calculate daily nutritional aggregates.
2. **Polymorphic Document Store (MongoDB 6+):** Stores rich recipe documents with variable ingredient lists, preparation steps, dietary tags, allergen arrays, per-serving macronutrient breakdown, and arbitrary metadata (equipment, regional tags, substitutions).
3. **Cross-Database Referential Integrity:** MySQL `recipe_catalog.recipe_id` and MongoDB `recipes._id` share the exact same 36-character UUID (`crypto.randomUUID()`). A dual-write orchestrator ensures atomic insertion with automated compensation (rollback) if any step fails.

```
                              ┌────────────────────────────────────────┐
                              │     Next.js 14+ (App Router, TS)       │
                              │       Tailwind CSS + Recharts          │
                              └───────────────────┬────────────────────┘
                                                  │
                         ┌────────────────────────┴────────────────────────┐
                         │                                                 │
                         ▼                                                 ▼
        ┌─────────────────────────────────┐               ┌─────────────────────────────────┐
        │            MySQL 8.0            │               │           MongoDB 7.0           │
        ├─────────────────────────────────┤               ├─────────────────────────────────┤
        │ • users (Auth & metrics)        │               │ • recipes collection            │
        │ • dietary_profiles (1:1)        │  Cross-DB     │   - _id (UUID matching MySQL)   │
        │ • nutrition_goals (1:N)         │  Referential  │   - ingredients [ ]             │
        │ • recipe_catalog (Catalog key)  │◄─────────────►│   - instructions [ ]            │
        │ • daily_nutrition_logs (1:N)    │  Integrity    │   - dietary_tags [ ] (indexed)  │
        │ • meal_logs (1:N)               │               │   - allergens [ ] (indexed)     │
        │ • DB Triggers (Auto Aggregates) │               │   - nutrition_per_serving       │
        │ • Stored Procedures (sp_log_meal)               │   - Dynamic extra fields        │
        │ • Views (daily summary)         │               │   - Full-text search index      │
        └─────────────────────────────────┘               └─────────────────────────────────┘
```

---

## 2. Problem Statement & Database Split

### Problem Statement
Modern health applications require strict relational guarantees for identity, audit logs, and date-range health targets, while simultaneously needing fluid, evolving document storage for global culinary recipes with arbitrary numbers of steps, ingredients, cooking techniques, and allergen notes. Enforcing this in a pure SQL database requires extensive joins and null fields; doing it in a pure NoSQL database risks data inconsistency, underflow, and broken relational references.

### Database Split Justification

| Data Entity | Database Engine | Justification |
| :--- | :--- | :--- |
| **Users, Auth, Profiles** | **MySQL 8.0** | Atomic registration, UNIQUE email constraints, foreign key cascades, bcrypt hash isolation. |
| **Nutrition Goals & Daily Totals** | **MySQL 8.0** | Check constraints (`>= 0`), date-range validations, aggregate integrity via DB triggers. |
| **Meal Logs** | **MySQL 8.0** | Strict FK relationships with users and daily logs; transactional writes via `sp_log_meal`. |
| **Recipe Identity / Catalog Key** | **MySQL 8.0** | Stable relational key for foreign-key references from meal logs (`ON DELETE SET NULL`). |
| **Full Recipe Documents** | **MongoDB 7.0** | Hierarchical document structure (nested arrays of ingredients and steps) that naturally models recipes. |
| **Search & Filtering Indexes** | **MongoDB 7.0** | Multi-key array indexes (`allergens`, `dietary_tags`) and `$text` indexes for instant zero-join filtering. |

---

## 3. Database Schemas, Triggers & Procedures

### MySQL Relational Tables (`sql/01_schema.sql`)
- `users`: `user_id` (PK, CHAR(36)), `full_name`, `email` (UNIQUE), `password_hash`, `date_of_birth`, `height_cm`, `weight_kg`, `activity_level`.
- `dietary_profiles`: `profile_id` (PK), `user_id` (UNIQUE FK -> users), `diet_type` (CHECK enum), `allergy_notes`, `intolerance_notes`.
- `nutrition_goals`: `goal_id` (PK), `user_id` (FK), `goal_type`, `target_calories`, `target_protein_g`, `target_carbs_g`, `target_fat_g`, `start_date`, `end_date` (`end_date >= start_date`).
- `recipe_catalog`: `recipe_id` (PK, CHAR(36) matching Mongo `_id`), `recipe_name`, `cuisine`, `is_active` (soft delete flag).
- `daily_nutrition_logs`: `log_id` (PK), `user_id` (FK), `log_date` (UNIQUE with `user_id`), `total_calories`, `total_protein_g`, `total_carbs_g`, `total_fat_g`, `water_ml`.
- `meal_logs`: `meal_log_id` (PK), `log_id` (FK -> daily_nutrition_logs), `recipe_id` (FK -> recipe_catalog, SET NULL), `meal_type`, `servings`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `notes`.

### Database Triggers (`sql/04_triggers.sql`)
1. **`trg_users_after_insert`**: Immediately inserts a corresponding row in `dietary_profiles` with `diet_type = 'other'` upon user registration.
2. **`trg_goals_before_insert`**: Validates date ranges and raises `SIGNAL SQLSTATE '45000'` if a newly inserted goal overlaps with an existing goal of the same user.
3. **`trg_goals_before_update`**: Companion trigger preventing overlapping date ranges on goal updates.
4. **`trg_meal_before_insert`**: Blocks meal entries if the referenced recipe in `recipe_catalog` has `is_active = FALSE`.
5. **`trg_meal_after_insert`**: Automatically increments `total_calories`, `total_protein_g`, `total_carbs_g`, and `total_fat_g` in `daily_nutrition_logs`.
6. **`trg_meal_after_update`**: Handles delta adjustments (subtracts `OLD`, adds `NEW`) on daily log totals when a meal is updated.
7. **`trg_meal_after_delete`**: Decrements nutrient totals on meal deletion using `GREATEST(0, ...)` to ensure non-negative check constraints are never violated.

> **Key Architecture Rule:** Because the database maintains daily totals via triggers, application code NEVER modifies daily totals directly.

### Stored Procedures (`sql/05_procedures.sql`)
- **`sp_log_meal(...)`**: Runs inside a MySQL `START TRANSACTION` with `EXIT HANDLER FOR SQLEXCEPTION` (rollback on error). Finds or creates the user's `daily_nutrition_logs` row for the target date, calculates total nutrients (`per_serving * servings`), inserts the `meal_logs` record, and returns both IDs.
- **`sp_get_active_goal(...)`**: Returns the active nutrition goal for a given user and date.

### Summary View (`sql/03_view.sql`)
- **`user_daily_nutrition_summary`**: Joins `users`, `daily_nutrition_logs`, `meal_logs`, and active `nutrition_goals` to compute live daily summaries, total meals logged, and percentage of target calorie fulfillment.

### MongoDB Recipe Model (`scripts/mongo-indexes.ts`)
Indexes created:
```javascript
db.recipes.createIndex({ recipe_name: "text", description: "text", "ingredients.name": "text", "instructions.text": "text" });
db.recipes.createIndex({ cuisine: 1 });
db.recipes.createIndex({ meal_type: 1 });
db.recipes.createIndex({ dietary_tags: 1 });
db.recipes.createIndex({ allergens: 1 });
db.recipes.createIndex({ "nutrition_per_serving.calories": 1 });
```

---

## 4. Quickstart: Setup & Execution Steps

### Prerequisites
- Node.js 18+ and npm
- Docker & Docker Compose (or local MySQL 8.0 and MongoDB 6+)

### Method A: Docker Compose (Recommended)

1. **Start the database containers:**
   ```bash
   docker compose up -d
   ```
   *Spins up MySQL 8.0 on port 3306 and MongoDB 7.0 on port 27017 with persistent volumes and health checks.*

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Initialize MySQL schema, triggers, views, and procedures:**
   ```bash
   npm run db:mysql
   ```

4. **Create MongoDB indexes and seed the 25+ recipe collection:**
   ```bash
   npm run db:mongo
   ```

5. **Seed demo users, goals, and 14 days of tracked meals:**
   ```bash
   npm run seed
   ```

6. **Start the Next.js development server:**
   ```bash
   npm run dev
   ```
   Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

### Method B: Plain Local Installation

If running MySQL and MongoDB natively on your machine:
1. Ensure MySQL is running on port 3306 with credentials matching `.env.local`:
   ```bash
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=rootpassword
   MYSQL_DATABASE=nutrition_tracker
   ```
2. Ensure MongoDB is running on port 27017:
   ```bash
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB=nutrition_tracker
   ```
3. Run the exact same sequence:
   ```bash
   npm install
   npm run db:mysql
   npm run db:mongo
   npm run seed
   npm run dev
   ```

---

## 5. Demo Credentials

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Primary Demo User** | `demo@nutrition.test` | `Demo@1234` | Active maintenance goal (2100 kcal), 14 days of logged meals, non-veg profile with peanut allergy. |
| **Secondary User** | `priya@example.com` | `Demo@1234` | Vegetarian profile, weight loss goal (1600 kcal). |
| **Tertiary User** | `rohan@example.com` | `Demo@1234` | High-protein profile, weight gain goal (2800 kcal). |

---

## 6. Review 1 Evaluation Walkthrough

The application includes a dedicated **Review Console** at `/review` designed specifically for faculty evaluation. No login is required to test the review console.

### Step 1: Schema & Relational Integrity Verification
1. Navigate to `/review` and open the **"📋 MySQL Tables"** tab.
2. Click **"Execute Schema Inspection"**.
3. Verify:
   - `SHOW TABLES` lists all 6 base tables and the `user_daily_nutrition_summary` view.
   - Click `DESC` for each table to verify types (`CHAR(36)`, `DECIMAL(8,2)`), defaults, and nullability.
   - Review the **Foreign Keys table** queried from `information_schema.KEY_COLUMN_USAGE`.
   - Review live row counts and the first 20 records of each table.

### Step 2: Trigger Demonstration (Live Scenarios)
1. Open the **"⚡ Triggers"** tab on `/review`.
2. Inspect the installed triggers via `SHOW TRIGGERS`.
3. For each of the 6 triggers, click **"▶ Run Live Demo"**:
   - `trg_users_after_insert`: Inserts a user inside an isolated transaction and shows the auto-created `dietary_profiles` record.
   - `trg_goals_before_insert`: Attempts to insert an overlapping goal for today and displays the actual MySQL `SIGNAL 45000` error: *"Goal date range overlaps an existing goal for this user."*
   - `trg_meal_before_insert`: Marks a sample recipe as `is_active = FALSE` and attempts to log a meal against it, catching the custom `SIGNAL 45000` rejection.
   - `trg_meal_after_insert`: Inserts a 350 kcal meal and shows before/after rows of `daily_nutrition_logs.total_calories` increasing automatically.
   - `trg_meal_after_update`: Updates a meal's calories and shows daily totals adjusted accordingly.
   - `trg_meal_after_delete`: Deletes a meal and proves daily totals decrement safely.

### Step 3: Dual-Write & Cross-Database Synchronization
1. Open the **"🔄 Data Flow"** tab on `/review`.
2. Click **"🚀 Create Sample Recipe & Verify Cross-Database UUID"**.
3. Observe the step-by-step `syncLog`:
   - Step 1: Zod validation passes.
   - Step 2: Generates a shared 36-character UUID (`crypto.randomUUID()`).
   - Step 3: Inserts full document into MongoDB (`recipes._id = UUID`).
   - Step 4: Inserts relational metadata into MySQL (`recipe_catalog.recipe_id = UUID`).
   - Side-by-side JSON comparison proves the same UUID exists in both databases.
4. Verify compensation semantics: if MySQL fails, MongoDB document is automatically deleted.

### Step 4: Live Meal Logging & Stored Procedure
1. Navigate to `/log`.
2. Select today's date.
3. Search for a recipe (e.g., "Paneer Quinoa Bowl") or enter manual values.
4. Click **"Save to MySQL (via sp_log_meal)"**.
5. Observe the daily totals card update immediately through database triggers.

### Step 5: Personalized Recommendations & Hybrid Retrieval
1. Navigate to `/recommendations`.
2. Click **"🔍 Show How This Was Computed"**.
3. View the hybrid pipeline in real time:
   - **MySQL context:** Reads the active goal (target calories, logged today, remaining budget, diet type, allergy notes).
   - **Calculations:** Derives per-meal budget (`remaining / meals_remaining`) and defines a ±20% calorie window.
   - **MongoDB Filter:** Shows the executed JSON query using `$nin` for allergen exclusion and `$in` for allowed dietary tags.
   - **Ranking:** Scores results based on calorie budget proximity and protein density.

### Step 6: Analytical Queries
1. Open the **"📊 Queries"** tab on `/review`.
2. Run each demo query:
   - **Days Over Calorie Target (`GROUP BY / HAVING`)**
   - **Full Multi-Table Relational JOIN** (`users` -> `daily_nutrition_logs` -> `meal_logs`)
   - **7-Day Rolling Weekly Nutrient Averages**
   - **Most-Logged Recipes in Catalog**
   - **Protein Efficiency Ranking**
