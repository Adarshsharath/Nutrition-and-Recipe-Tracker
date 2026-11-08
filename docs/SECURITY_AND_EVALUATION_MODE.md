# Security Architecture & Evaluation Mode Specification

**Project**: Personalized Nutrition & Recipe Tracker  
**Course**: Database Management Systems (Experiential Learning – Level 3)  
**Instructor**: Prof. Deena Hajim  
**Team**: Adarsh Prakash (PES2UG24CS027), Abhirama H Y (PES2UG24CS023) — Section A  
**Branch**: `security/review-console-protection`

---

## 1. Overview & Threat Model

The application includes an interactive **DBMS Review Console** (`/review`) and underlying administrative endpoints designed for demonstrating relational integrity, trigger mechanics, stored programs, cross-database synchronization, and analytical SQL queries.

### The Threat
In standard operation, review and administrative endpoints execute:
- Complete relational metadata inspection (`information_schema.KEY_COLUMN_USAGE`, `SHOW TABLES`, `SHOW INDEX`, `DESCRIBE`).
- Stored trigger code inspection (`SHOW CREATE TRIGGER`).
- Analytical queries across user meal histories and nutritional records.
- MongoDB index definitions, recipe document dumps, and query execution plans (`explain('executionStats')`).
- Cross-database consistency audits (`/api/admin/sync-check`).
- **Database Write Transactions**:
  - `/api/review/triggers/[name]/demo`: Inserts users, sets up goal conflicts, tests inactive recipe rejection, and verifies incremental trigger updates.
  - `/api/review/dataflow/demo`: Performs coordinated dual-writes across MySQL and MongoDB.

Leaving these endpoints accessible without authentication in production environments exposes full database topology, schema definitions, and exposes write endpoints to unauthorized abuse.

### The Security Solution
To reconcile **convenient local faculty viva demonstrations** with **enterprise-grade production security**, the application implements an explicit **Evaluation Mode Gatekeeper** combined with **JWT Hardening** and **Error Sanitization**.

---

## 2. Evaluation Mode Architecture

### Truth Table: Access Control Matrix

| Environment (`NODE_ENV`) | `EVALUATION_MODE` Setting | Request Authentication | Access to Review / Admin APIs | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **`development`** | `true` | Anonymous (No Token) | **ALLOWED (200 OK)** | Local faculty viva demonstration mode. |
| **`development`** | `true` | Valid Token / Cookie | **ALLOWED (200 OK)** | Authenticated developer access. |
| **`development`** | `false` or unset | Anonymous (No Token) | **DENIED (401 Unauthorized)** | Strict default; evaluation must be explicitly enabled. |
| **`development`** | `false` or unset | Valid Token / Cookie | **ALLOWED (200 OK)** | Standard authenticated development. |
| **`production`** | `true` | Anonymous (No Token) | **DENIED (401 Unauthorized)** | **Production hard-lock**: `EVALUATION_MODE` is strictly ignored. |
| **`production`** | `true` | Valid Token / Cookie | **ALLOWED (200 OK)** | Authorized administrator access. |
| **`production`** | `false` or unset | Anonymous (No Token) | **DENIED (401 Unauthorized)** | Strict production default. |
| **`production`** | `false` or unset | Valid Token / Cookie | **ALLOWED (200 OK)** | Authorized administrator access. |

### Evaluation Mode Implementation

The security gatekeeper is centralized in [`lib/auth.ts`](../lib/auth.ts):

```typescript
export function isEvaluationModeActive(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.EVALUATION_MODE === 'true'
  );
}

export async function requireReviewAccess(
  req?: Request | NextRequest
): Promise<
  | { authorized: true; user?: AuthPayload }
  | { authorized: false; response: NextResponse }
> {
  if (isEvaluationModeActive()) {
    const user = await authenticateRequest(req);
    return { authorized: true, user: user ?? undefined };
  }

  const user = await authenticateRequest(req);
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          message:
            process.env.NODE_ENV === 'production'
              ? 'Access denied: Valid authentication required in production environment.'
              : 'Access denied: Evaluation mode is disabled (set EVALUATION_MODE=true in .env.local for local faculty demonstration) or log in with valid credentials.',
        },
        { status: 401 }
      ),
    };
  }

  return { authorized: true, user };
}
```

---

## 3. Catalog of Protected Endpoints

All thirteen administrative and review endpoints enforce API-level protection via `requireReviewAccess`:

### Relational Schema & Inspection APIs (MySQL)
1. `GET /api/review/mysql/tables`: Inspects table inventory via `SHOW TABLES`.
2. `GET /api/review/mysql/describe?table=<name>`: Validates column types, constraints, and fetches sample records.
3. `GET /api/review/mysql/foreign-keys`: Queries `information_schema.KEY_COLUMN_USAGE` for referential integrity graphs.
4. `GET /api/review/mysql/indexes`: Enumerates all active indexes across entities.
5. `GET /api/review/mysql/triggers`: Inspects triggers and executes `SHOW CREATE TRIGGER`.
6. `GET /api/review/mysql/view`: Queries the `user_daily_nutrition_summary` view.
7. `GET /api/review/queries?q=<name>`: Executes analytical SQL queries (GROUP BY/HAVING, multi-table joins, weekly averages).

### Document Store Inspection APIs (MongoDB)
8. `GET /api/review/mongo/recipes`: Paged inspection of raw recipe JSON documents.
9. `GET /api/review/mongo/indexes`: Inspects compound and text indexes on the `recipes` collection.
10. `GET /api/review/mongo/explain`: Generates query execution plans with `executionStats` for index verification.

### Database Write & Demonstration Endpoints
11. `POST /api/review/triggers/[name]/demo`: Executes live trigger demonstrations inside transactional rollbacks (tests `trg_users_after_insert`, `trg_goals_before_insert`, `trg_goals_before_update`, `trg_meal_before_insert`, `trg_meal_after_insert`, `trg_meal_after_update`, `trg_meal_after_delete`).
12. `POST /api/review/dataflow/demo`: Demonstrates coordinated dual-write across MySQL (`recipe_catalog`) and MongoDB (`recipes`).

### Cross-Database Consistency Audit
13. `GET /api/admin/sync-check`: Audits orphaned documents, missing catalog IDs, and cross-database referential consistency.

---

## 4. JWT Secret Security & Token Hardening

### Production Secret Guard
Previously, `lib/auth.ts` contained a hardcoded fallback string (`change-me-in-production-32-chars!!`). This vulnerability has been eliminated:
1. **Production Mode Guard**: If `NODE_ENV === 'production'`, `getJwtSecret()` strictly requires `process.env.JWT_SECRET`.
   - If missing, it immediately throws a fatal exception, preventing the signing or verification of forged or default tokens.
   - If `JWT_SECRET` is shorter than 32 characters in production, it throws an error to enforce HMAC-SHA256 entropy.
2. **Development Mode Guard**: In local development (`NODE_ENV === 'development'`), if `JWT_SECRET` is omitted, the application uses an isolated dev key and logs an explicit warning to the console.
3. **Multi-Source Credential Resolution**:
   - `authenticateRequest` inspects both the `Authorization: Bearer <token>` HTTP header and the `auth_token` httpOnly cookie.
   - Enables seamless authentication from browser sessions, CLI scripts, `curl`, and automated audit pipelines.

---

## 5. Error Sanitization Policy

All review and administrative endpoints wrap database operations in `try / catch` blocks and invoke `sanitizeError()`:
- **Redaction of Connection Strings**: Matches and masks MongoDB connection strings (`mongodb://***:***@host`) and MySQL credentials.
- **Redaction of Secrets & Passwords**: Regex scrubbing of `password=***`, `secret=***`, and bearer tokens.
- **Production Information Shielding**: In production (`NODE_ENV === 'production'`), detailed database errors (such as `ECONNREFUSED` or raw table details) are collapsed into safe generic messages (e.g., `"Database connection or operation failed."`), while development environments retain sanitized diagnostics for troubleshooting.

---

## 6. How to Run: Local Viva Evaluation vs Production

### A. Local Viva Demonstration (Evaluation Mode)
1. Ensure `.env.local` contains:
   ```env
   NODE_ENV=development
   EVALUATION_MODE=true
   MYSQL_PASSWORD=123456
   JWT_SECRET=demo-secret-key-nutrition-tracker-32chars-min-ok!
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000/review`.
4. The console displays the badge: `🟢 Evaluation Mode Active (Viva Demonstration)`.
5. Faculty and evaluators can inspect schemas, execute trigger tests, view MongoDB execution plans, and run analytical queries without requiring login.

### B. Local Protected Mode (Testing Authentication Enforcement)
1. In `.env.local`, set:
   ```env
   EVALUATION_MODE=false
   ```
2. Restart `npm run dev`.
3. Open `http://localhost:3000/review`.
4. The console displays: `🔒 Protected Console · Login Required`.
5. Direct unauthenticated requests to `/api/review/mysql/tables` return `401 Unauthorized`.
6. Log in via `http://localhost:3000/login` with `demo@nutrition.test` / `Demo@1234`.
7. Return to `/review` — the badge updates to `🔒 Protected Console · Authenticated (demo@nutrition.test)` and full access is granted.

### C. Production Deployment Mode
1. Set environment variables on the production host:
   ```env
   NODE_ENV=production
   JWT_SECRET=<strong-random-key-with-minimum-32-characters>
   MYSQL_HOST=<db-host>
   MYSQL_USER=<db-user>
   MYSQL_PASSWORD=<db-password>
   MONGODB_URI=<mongo-uri>
   ```
2. Build and start the production application:
   ```bash
   npm run build
   npm start
   ```
3. Anonymous access to `/api/review/*` and `/api/admin/*` is strictly blocked with `401 Unauthorized`, even if `EVALUATION_MODE=true` is set.
4. Only requests with a valid JWT signed by the production `JWT_SECRET` are accepted.

---

## 7. Remaining Security Considerations & Roadmap
1. **Role-Based Access Control (RBAC)**: Future iterations can distinguish between standard users and `admin` roles, restricting write demos to users with `role: 'evaluator'` or `role: 'admin'`.
2. **Rate Limiting**: In production deployments exposed to public networks, endpoints should be fronted with IP-based rate limiting (e.g. Next.js middleware using Upstash Redis or Cloudflare WAF) to mitigate Denial of Service against compute-intensive review queries.
3. **HTTPS / TLS Termination**: Production tokens (`auth_token`) must always be delivered over HTTPS with the `Secure` cookie flag enabled.

