import { Logger, Provider } from '@nestjs/common';
import { App, ServiceAccount, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';

export const FIREBASE_APP = 'FIREBASE_APP';

const logger = new Logger('FirebaseProvider');

/**
 * Resolves the service account, in order of preference:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON  — the whole JSON inline (raw or base64). Use this in production.
 *   2. FIREBASE_SERVICE_ACCOUNT_PATH  — absolute path to the JSON file on the server.
 *   3. a `*firebase-adminsdk*.json` file in the project root — local development only.
 */
function loadServiceAccount(): ServiceAccount | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      const raw = inline.trim().startsWith('{')
        ? inline
        : Buffer.from(inline, 'base64').toString('utf8');
      return JSON.parse(raw);
    } catch {
      logger.error('FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON or base64 JSON');
      return null;
    }
  }

  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (explicitPath) {
    if (!fs.existsSync(explicitPath)) {
      logger.error(`FIREBASE_SERVICE_ACCOUNT_PATH points at a missing file: ${explicitPath}`);
      return null;
    }
    return JSON.parse(fs.readFileSync(explicitPath, 'utf8'));
  }

  // process.cwd() is the project root under both `start:dev` and `start:prod`.
  const root = process.cwd();
  const discovered = fs
    .readdirSync(root)
    .find((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'));

  if (!discovered) return null;
  return JSON.parse(fs.readFileSync(path.join(root, discovered), 'utf8'));
}

/**
 * Firebase Admin app, or `null` when no credentials are configured.
 * A null app disables push; it never blocks boot, so the API still runs
 * (and sockets still work) on a machine without the service account.
 */
export const firebaseProvider: Provider = {
  provide: FIREBASE_APP,
  useFactory: (): App | null => {
    if (getApps().length) return getApp();

    let serviceAccount: ServiceAccount | null = null;
    try {
      serviceAccount = loadServiceAccount();
    } catch (err) {
      logger.error(`Failed to read the Firebase service account: ${err.message}`);
      return null;
    }

    if (!serviceAccount) {
      logger.warn('No Firebase service account found — push notifications are disabled');
      return null;
    }

    const app = initializeApp({
      credential: cert(serviceAccount),
    });
    logger.log(`Firebase initialised for project ${(serviceAccount as any).project_id}`);
    return app;
  },
};
