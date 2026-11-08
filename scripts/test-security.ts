/**
 * Comprehensive Security & Evaluation Mode Test Suite
 * 
 * Verifies:
 * - Test A: Local evaluation mode enabled (NODE_ENV=development, EVALUATION_MODE=true) -> 200 OK anonymous
 * - Test B: Evaluation mode disabled (EVALUATION_MODE=false) -> 401 Unauthorized anonymous, 200 OK authenticated
 * - Test C: Production mode (NODE_ENV=production) -> 401 Unauthorized even if EVALUATION_MODE=true, 200 OK authenticated
 * - Test D: JWT secret security -> strict production requirement, rejection of short/missing secrets, safe dev fallback
 * - Test E: Error sanitization -> masking of database credentials, connection URIs, tokens, and stack traces
 */

import { NextRequest } from 'next/server';
import {
  isEvaluationModeActive,
  requireReviewAccess,
  signToken,
  verifyToken,
  sanitizeError,
  getJwtSecret,
  authenticateRequest,
} from '../lib/auth';

// Import Route Handlers
import { GET as getTables } from '../app/api/review/mysql/tables/route';
import { GET as getDescribe } from '../app/api/review/mysql/describe/route';
import { GET as getFks } from '../app/api/review/mysql/foreign-keys/route';
import { GET as getIndexes } from '../app/api/review/mysql/indexes/route';
import { GET as getTriggers } from '../app/api/review/mysql/triggers/route';
import { GET as getView } from '../app/api/review/mysql/view/route';
import { GET as getQueries } from '../app/api/review/queries/route';
import { GET as getMongoRecipes } from '../app/api/review/mongo/recipes/route';
import { GET as getMongoIndexes } from '../app/api/review/mongo/indexes/route';
import { GET as getMongoExplain } from '../app/api/review/mongo/explain/route';
import { POST as postTriggerDemo } from '../app/api/review/triggers/[name]/demo/route';
import { POST as postDataflowDemo } from '../app/api/review/dataflow/demo/route';
import { GET as getAdminSyncCheck } from '../app/api/admin/sync-check/route';

const TEST_SECRET = 'a-super-secret-jwt-key-with-over-32-characters-for-testing!';
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failedTests++;
  }
}

async function createAuthToken(): Promise<string> {
  process.env.JWT_SECRET = TEST_SECRET;
  return signToken({ userId: 'test-user-uuid-1234-5678-abcdef', email: 'tester@nutrition.test' });
}

function makeRequest(url: string, method = 'GET', token?: string): NextRequest {
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
  });
}

async function runTestSuite() {
  console.log('\n============================================================');
  console.log('  DBMS EXPERIENTIAL LEARNING – LEVEL 3: SECURITY AUDIT SUITE');
  console.log('  Testing Evaluation Mode & Review Console Access Control');
  console.log('============================================================\n');

  const validToken = await createAuthToken();

  // ============================================================
  // Test D: JWT Secret Validation & Hardening
  // ============================================================
  console.log('--- Test D: JWT Secret Security & Production Hardening ---');
  
  // D.1 Production requires JWT_SECRET
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  try {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    let threw = false;
    try {
      getJwtSecret();
    } catch (e: any) {
      threw = e.message.includes('missing in production mode');
    }
    assert(threw, 'D.1 Production throws error when JWT_SECRET is missing');

    // D.2 Production rejects secret shorter than 32 chars
    process.env.JWT_SECRET = 'short-secret';
    let threwShort = false;
    try {
      getJwtSecret();
    } catch (e: any) {
      threwShort = e.message.includes('at least 32 characters');
    }
    assert(threwShort, 'D.2 Production throws error when JWT_SECRET is shorter than 32 characters');

    // D.3 Production accepts valid secret
    process.env.JWT_SECRET = TEST_SECRET;
    const prodSecret = getJwtSecret();
    assert(prodSecret.length >= 32, 'D.3 Production accepts valid >=32-char JWT_SECRET');

    // D.4 Development allows fallback when JWT_SECRET is unset
    (process.env as any).NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    const devSecret = getJwtSecret();
    assert(devSecret.length >= 32, 'D.4 Development falls back safely with console warning');

    // D.5 Token signing and verification roundtrip
    process.env.JWT_SECRET = TEST_SECRET;
    const token = await signToken({ userId: 'uid-1', email: 'test@demo.com' });
    const verified = await verifyToken(token);
    assert(verified.userId === 'uid-1' && verified.email === 'test@demo.com', 'D.5 Token signs and verifies payload correctly');

  } finally {
    (process.env as any).NODE_ENV = originalEnv;
    process.env.JWT_SECRET = originalSecret ?? TEST_SECRET;
  }

  // ============================================================
  // Test E: Error Sanitization
  // ============================================================
  console.log('\n--- Test E: Error Sanitization & Credential Masking ---');
  
  const rawMongoErr = new Error('Connection failed to mongodb://dbuser:supersecretpass123@mongo.cluster.net:27017/nutrition_tracker?authSource=admin');
  const sanitizedMongo = sanitizeError(rawMongoErr);
  assert(!sanitizedMongo.includes('supersecretpass123'), 'E.1 Masked MongoDB password');
  assert(sanitizedMongo.includes('mongodb://dbuser:***@'), 'E.2 Retained safe connection host context without credentials');

  const rawMysqlErr = new Error('Access denied for user root@localhost using password: "superSecretPassword!"');
  const sanitizedMysql = sanitizeError(rawMysqlErr);
  assert(!sanitizedMysql.includes('superSecretPassword!'), 'E.3 Masked MySQL raw password');

  // In production mode, sensitive details collapsed
  (process.env as any).NODE_ENV = 'production';
  const prodErr = sanitizeError(new Error('connect ECONNREFUSED 127.0.0.1:3306'));
  assert(prodErr === 'Database connection or operation failed.', 'E.4 Production collapses raw network stack into safe message');
  (process.env as any).NODE_ENV = 'development';

  // ============================================================
  // Test A: Evaluation Mode Enabled (Dev + EVALUATION_MODE=true)
  // ============================================================
  console.log('\n--- Test A: Local Evaluation Mode Enabled (NODE_ENV=dev, EVALUATION_MODE=true) ---');
  (process.env as any).NODE_ENV = 'development';
  process.env.EVALUATION_MODE = 'true';
  process.env.JWT_SECRET = TEST_SECRET;

  assert(isEvaluationModeActive() === true, 'A.0 isEvaluationModeActive() reports true');

  // Verify anonymous access to all review & admin routes
  const evalTablesRes = await getTables(makeRequest('/api/review/mysql/tables'));
  assert(evalTablesRes.status === 200, 'A.1 Anonymous access to /api/review/mysql/tables -> 200 OK');

  const evalDescRes = await getDescribe(makeRequest('/api/review/mysql/describe?table=users'));
  assert(evalDescRes.status === 200, 'A.2 Anonymous access to /api/review/mysql/describe -> 200 OK');

  const evalFksRes = await getFks(makeRequest('/api/review/mysql/foreign-keys'));
  assert(evalFksRes.status === 200, 'A.3 Anonymous access to /api/review/mysql/foreign-keys -> 200 OK');

  const evalIdxRes = await getIndexes(makeRequest('/api/review/mysql/indexes?table=users'));
  assert(evalIdxRes.status === 200, 'A.4 Anonymous access to /api/review/mysql/indexes -> 200 OK');

  const evalTrigRes = await getTriggers(makeRequest('/api/review/mysql/triggers'));
  assert(evalTrigRes.status === 200, 'A.5 Anonymous access to /api/review/mysql/triggers -> 200 OK');

  const evalViewRes = await getView(makeRequest('/api/review/mysql/view'));
  assert(evalViewRes.status === 200, 'A.6 Anonymous access to /api/review/mysql/view -> 200 OK');

  const evalQueriesRes = await getQueries(makeRequest('/api/review/queries?q=topRecipes'));
  assert(evalQueriesRes.status === 200, 'A.7 Anonymous access to /api/review/queries -> 200 OK');

  const evalMongoRecRes = await getMongoRecipes(makeRequest('/api/review/mongo/recipes?limit=5'));
  assert(evalMongoRecRes.status === 200, 'A.8 Anonymous access to /api/review/mongo/recipes -> 200 OK');

  const evalMongoIdxRes = await getMongoIndexes(makeRequest('/api/review/mongo/indexes'));
  assert(evalMongoIdxRes.status === 200, 'A.9 Anonymous access to /api/review/mongo/indexes -> 200 OK');

  const evalMongoExpRes = await getMongoExplain(makeRequest('/api/review/mongo/explain?cuisine=Indian'));
  assert(evalMongoExpRes.status === 200, 'A.10 Anonymous access to /api/review/mongo/explain -> 200 OK');

  const evalTrigDemoRes = await postTriggerDemo(
    makeRequest('/api/review/triggers/trg_users_after_insert/demo', 'POST'),
    { params: Promise.resolve({ name: 'trg_users_after_insert' }) }
  );
  assert(evalTrigDemoRes.status === 200, 'A.11 Anonymous access to write demo /api/review/triggers/[name]/demo -> 200 OK');

  const evalDataflowRes = await postDataflowDemo(makeRequest('/api/review/dataflow/demo', 'POST'));
  assert(evalDataflowRes.status === 200, 'A.12 Anonymous access to write demo /api/review/dataflow/demo -> 200 OK');

  const evalAdminRes = await getAdminSyncCheck(makeRequest('/api/admin/sync-check'));
  assert(evalAdminRes.status === 200, 'A.13 Anonymous access to /api/admin/sync-check -> 200 OK');

  // ============================================================
  // Test B: Evaluation Mode Disabled (Dev + EVALUATION_MODE=false)
  // ============================================================
  console.log('\n--- Test B: Evaluation Mode Disabled (NODE_ENV=dev, EVALUATION_MODE=false) ---');
  (process.env as any).NODE_ENV = 'development';
  process.env.EVALUATION_MODE = 'false';

  assert(isEvaluationModeActive() === false, 'B.0 isEvaluationModeActive() reports false');

  // Anonymous must be denied (401)
  const bAnonTables = await getTables(makeRequest('/api/review/mysql/tables'));
  assert(bAnonTables.status === 401, 'B.1 Anonymous /api/review/mysql/tables denied with 401');

  const bAnonTrigDemo = await postTriggerDemo(
    makeRequest('/api/review/triggers/trg_users_after_insert/demo', 'POST'),
    { params: Promise.resolve({ name: 'trg_users_after_insert' }) }
  );
  assert(bAnonTrigDemo.status === 401, 'B.2 Anonymous write demo /api/review/triggers/trg_users_after_insert/demo denied with 401');

  const bAnonDataflow = await postDataflowDemo(makeRequest('/api/review/dataflow/demo', 'POST'));
  assert(bAnonDataflow.status === 401, 'B.3 Anonymous write demo /api/review/dataflow/demo denied with 401');

  const bAnonAdmin = await getAdminSyncCheck(makeRequest('/api/admin/sync-check'));
  assert(bAnonAdmin.status === 401, 'B.4 Anonymous /api/admin/sync-check denied with 401');

  // Authenticated must be allowed (200)
  const bAuthTables = await getTables(makeRequest('/api/review/mysql/tables', 'GET', validToken));
  assert(bAuthTables.status === 200, 'B.5 Authenticated /api/review/mysql/tables permitted with 200 OK');

  const bAuthTrigDemo = await postTriggerDemo(
    makeRequest('/api/review/triggers/trg_users_after_insert/demo', 'POST', validToken),
    { params: Promise.resolve({ name: 'trg_users_after_insert' }) }
  );
  assert(bAuthTrigDemo.status === 200, 'B.6 Authenticated /api/review/triggers/demo permitted with 200 OK');

  // ============================================================
  // Test C: Production Mode (NODE_ENV=production)
  // ============================================================
  console.log('\n--- Test C: Production Mode (NODE_ENV=production) ---');
  (process.env as any).NODE_ENV = 'production';
  process.env.EVALUATION_MODE = 'true'; // Set to true to test that production ignores it!

  assert(isEvaluationModeActive() === false, 'C.0 isEvaluationModeActive() strictly false in production even if EVALUATION_MODE=true');

  // Anonymous must be denied (401)
  const cAnonTables = await getTables(makeRequest('/api/review/mysql/tables'));
  assert(cAnonTables.status === 401, 'C.1 Production anonymous /api/review/mysql/tables denied with 401');

  const cAnonTrigDemo = await postTriggerDemo(
    makeRequest('/api/review/triggers/trg_users_after_insert/demo', 'POST'),
    { params: Promise.resolve({ name: 'trg_users_after_insert' }) }
  );
  assert(cAnonTrigDemo.status === 401, 'C.2 Production anonymous write demo denied with 401');

  const cAnonDataflow = await postDataflowDemo(makeRequest('/api/review/dataflow/demo', 'POST'));
  assert(cAnonDataflow.status === 401, 'C.3 Production anonymous dataflow demo denied with 401');

  const cAnonAdmin = await getAdminSyncCheck(makeRequest('/api/admin/sync-check'));
  assert(cAnonAdmin.status === 401, 'C.4 Production anonymous /api/admin/sync-check denied with 401');

  // Authenticated must be allowed (200)
  const cAuthTables = await getTables(makeRequest('/api/review/mysql/tables', 'GET', validToken));
  assert(cAuthTables.status === 200, 'C.5 Production authenticated /api/review/mysql/tables permitted with 200 OK');

  const cAuthAdmin = await getAdminSyncCheck(makeRequest('/api/admin/sync-check', 'GET', validToken));
  assert(cAuthAdmin.status === 200, 'C.6 Production authenticated /api/admin/sync-check permitted with 200 OK');

  // Reset environment
  (process.env as any).NODE_ENV = 'development';
  process.env.EVALUATION_MODE = 'true';

  console.log('\n============================================================');
  console.log(`  AUDIT RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
