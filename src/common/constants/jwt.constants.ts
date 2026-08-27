/**
 * Single source of truth for JWT configuration.
 *
 * Every JwtModule.register() call, JwtAuthGuard and the socket gateway must use
 * these values — the secret and expiry used to be copy-pasted across 18 files,
 * which made changing either of them error-prone.
 */
import { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';

export const JWT_SECRET =
  process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Long-lived by design: a user stays signed in until they explicitly log out,
 * so closing the browser tab and coming back later does not force a re-login.
 * Override with JWT_EXPIRES_IN in the environment.
 */
export const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ||
  '30d') as JwtSignOptions['expiresIn'];

export const jwtModuleOptions: JwtModuleOptions = {
  secret: JWT_SECRET,
  signOptions: { expiresIn: JWT_EXPIRES_IN },
};
