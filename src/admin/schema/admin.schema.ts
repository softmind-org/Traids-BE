import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminDocument = HydratedDocument<Admin>;

export enum AdminRole {
  SUPER_ADMIN = 'super_admin',   // full access to everything
  SUPPORT     = 'support',       // view users, handle disputes
  FINANCE     = 'finance',       // view invoices and payments
  OPERATIONS  = 'operations',    // view jobs and timesheets
}

const SENSITIVE_FIELDS = ['password', 'resetToken', 'resetTokenExpires'];

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      SENSITIVE_FIELDS.forEach((f) => delete ret[f]);
      return ret;
    },
  },
})
export class Admin {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, enum: AdminRole, default: AdminRole.SUPPORT })
  role: AdminRole;

  // Fine-grained permissions — populated from role by default, overridable per admin
  // e.g. ['view:subcontractors', 'view:invoices', 'manage:users']
  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  resetToken?: string;

  @Prop()
  resetTokenExpires?: Date;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
