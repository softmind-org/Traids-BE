/**
 * Run this script ONCE to create the first SUPER_ADMIN.
 * After running, use POST /admin/auth/login to get a token,
 * then use POST /admin to create additional admins.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-admin.ts
 */

import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const ADMIN_EMAIL = 'admin@traids.uk';
const ADMIN_PASSWORD = 'Admin@1234';
const ADMIN_FULL_NAME = 'Super Admin';

const AdminSchema = new mongoose.Schema(
  {
    fullName: String,
    email: { type: String, unique: true, lowercase: true },
    password: String,
    role: { type: String, default: 'super_admin' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const AdminModel = mongoose.model('Admin', AdminSchema);

  const existing = await AdminModel.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`Admin already exists: ${ADMIN_EMAIL}`);
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await AdminModel.create({
    fullName: ADMIN_FULL_NAME,
    email: ADMIN_EMAIL,
    password: hashedPassword,
    role: 'super_admin',
    isActive: true,
  });

  console.log('');
  console.log('Super Admin created successfully!');
  console.log('----------------------------------');
  console.log(`Email    : ${ADMIN_EMAIL}`);
  console.log(`Password : ${ADMIN_PASSWORD}`);
  console.log('----------------------------------');
  console.log('IMPORTANT: Change the password after first login.');
  console.log('');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
