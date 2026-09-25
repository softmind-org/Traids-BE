import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { App } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { FIREBASE_APP } from './firebase.provider';
import { Company, CompanyDocument } from '../company/schema/company.schema';
import {
  Subcontractor,
  SubcontractorDocument,
} from '../subcontractor/schema/subcontractor.schema';

export type PushUserType = 'company' | 'subcontractor';

export interface PushPayload {
  /** Same event name as the socket event, so the app can route both identically. */
  type: string;
  title: string;
  body: string;
  /** Extra routing info (jobId, offerId, …). Values are stringified for FCM. */
  data?: Record<string, any>;
}

/** FCM rejects these tokens permanently — drop them from the user on sight. */
const DEAD_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
];

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(FIREBASE_APP) private readonly firebaseApp: App | null,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Subcontractor.name)
    private subcontractorModel: Model<SubcontractorDocument>,
  ) { }

  private modelFor(userType: PushUserType): Model<any> {
    return userType === 'company' ? this.companyModel : this.subcontractorModel;
  }

  /** Only called behind a `this.firebaseApp` null check. */
  private messaging(): Messaging {
    return getMessaging(this.firebaseApp!);
  }

  /**
   * Store the token the mobile app sent on login.
   *
   * `$addToSet` is the whole "update it if it changed, otherwise leave it" rule:
   * a token already on the user is a no-op, a new one is appended. The pull on
   * other users covers a device where someone logs out and someone else logs in —
   * without it the previous account keeps receiving that phone's notifications.
   */
  async registerToken(
    userId: string,
    userType: PushUserType,
    fcmToken?: string,
  ): Promise<void> {
    if (!fcmToken) return;

    try {
      await Promise.all([
        this.companyModel.updateMany(
          { _id: { $ne: userId }, fcmTokens: fcmToken },
          { $pull: { fcmTokens: fcmToken } },
        ),
        this.subcontractorModel.updateMany(
          { _id: { $ne: userId }, fcmTokens: fcmToken },
          { $pull: { fcmTokens: fcmToken } },
        ),
      ]);

      await this.modelFor(userType).updateOne(
        { _id: userId },
        { $addToSet: { fcmTokens: fcmToken } },
      );
    } catch (err) {
      // Never let device registration break a login.
      this.logger.error(`Failed to register FCM token for ${userType} ${userId}: ${err.message}`);
    }
  }

  /** Called on logout, or when the app uninstalls/rotates its token. */
  async removeToken(
    userId: string,
    userType: PushUserType,
    fcmToken: string,
  ): Promise<void> {
    await this.modelFor(userType).updateOne(
      { _id: userId },
      { $pull: { fcmTokens: fcmToken } },
    );
  }

  private async getTokens(userId: string, userType: PushUserType): Promise<string[]> {
    const user = await this.modelFor(userType)
      .findById(userId)
      .select('+fcmTokens')
      .lean()
      .exec();

    return (user?.fcmTokens ?? []).filter(Boolean);
  }

  /** FCM only accepts string values in `data`. */
  private stringifyData(payload: PushPayload): Record<string, string> {
    const flat: Record<string, string> = { type: payload.type };

    for (const [key, value] of Object.entries(payload.data ?? {})) {
      if (value === undefined || value === null) continue;
      flat[key] =
        typeof value === 'string' ? value : JSON.stringify(value);
    }

    return flat;
  }

  /**
   * Send to every device a user has registered.
   *
   * Deliberately never throws: a push failure must not roll back the socket
   * emit or the DB notification it accompanies. Callers can fire and forget.
   */
  async sendToUser(
    userId: string,
    userType: PushUserType,
    payload: PushPayload,
  ): Promise<void> {
    if (!this.firebaseApp) return;

    try {
      const tokens = await this.getTokens(userId, userType);
      if (!tokens.length) return;

      const response = await this.messaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: this.stringifyData(payload),
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'traids_default' },
        },
        apns: {
          payload: { aps: { sound: 'default', contentAvailable: true } },
        },
      });

      const dead = response.responses
        .map((r, i) =>
          !r.success && r.error && DEAD_TOKEN_CODES.includes(r.error.code) ? tokens[i] : null,
        )
        .filter((t): t is string => t !== null);

      if (dead.length) {
        await this.modelFor(userType).updateOne(
          { _id: userId },
          { $pull: { fcmTokens: { $in: dead } } },
        );
        this.logger.log(`Pruned ${dead.length} dead token(s) from ${userType} ${userId}`);
      }

      this.logger.log(
        `Push "${payload.type}" to ${userType} ${userId}: ${response.successCount}/${tokens.length} delivered`,
      );
    } catch (err) {
      this.logger.error(`Push "${payload.type}" to ${userType} ${userId} failed: ${err.message}`);
    }
  }

  async sendToUsers(
    userIds: string[],
    userType: PushUserType,
    payload: PushPayload,
  ): Promise<void> {
    await Promise.all(userIds.map((id) => this.sendToUser(id, userType, payload)));
  }

  /**
   * For callers that only hold a user id (SocketService's generic helpers).
   * Company and Subcontractor are separate collections with no shared User
   * table, so the type has to be resolved by lookup.
   */
  async sendToUserId(userId: string, payload: PushPayload): Promise<void> {
    if (!this.firebaseApp) return;

    try {
      const isCompany = await this.companyModel.exists({ _id: userId });
      await this.sendToUser(userId, isCompany ? 'company' : 'subcontractor', payload);
    } catch (err) {
      this.logger.error(`Push "${payload.type}" to user ${userId} failed: ${err.message}`);
    }
  }

  /** FCM caps a multicast at 500 tokens. */
  private static readonly MULTICAST_LIMIT = 500;

  /** Fan out to every device of every user of one type. */
  async sendToUserType(userType: PushUserType, payload: PushPayload): Promise<void> {
    if (!this.firebaseApp) return;

    try {
      const users = await this.modelFor(userType)
        .find({ fcmTokens: { $exists: true, $ne: [] } })
        .select('+fcmTokens')
        .lean()
        .exec();

      const tokens = users.flatMap((u) => u.fcmTokens ?? []).filter(Boolean);
      if (!tokens.length) return;

      const messaging = this.messaging();
      let delivered = 0;

      for (let i = 0; i < tokens.length; i += PushService.MULTICAST_LIMIT) {
        const batch = tokens.slice(i, i + PushService.MULTICAST_LIMIT);
        const response = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title: payload.title, body: payload.body },
          data: this.stringifyData(payload),
          android: {
            priority: 'high',
            notification: { sound: 'default', channelId: 'traids_default' },
          },
          apns: { payload: { aps: { sound: 'default', contentAvailable: true } } },
        });
        delivered += response.successCount;
      }

      this.logger.log(
        `Push "${payload.type}" to all ${userType}s: ${delivered}/${tokens.length} delivered`,
      );
    } catch (err) {
      this.logger.error(`Push "${payload.type}" to all ${userType}s failed: ${err.message}`);
    }
  }

  async broadcast(payload: PushPayload): Promise<void> {
    await Promise.all([
      this.sendToUserType('company', payload),
      this.sendToUserType('subcontractor', payload),
    ]);
  }
}
