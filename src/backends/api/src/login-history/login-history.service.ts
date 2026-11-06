import { Injectable } from '@nestjs/common';
import { count, desc, eq, loginHistories, lt, type LoginHistory } from '@base/db';
import type { AppName, LoginHistoryDto } from '@base/shared';
import {
  getClientIp,
  getLocationFromHeaders,
  isPrivateIp,
  logger,
  lookupIpLocation,
  parseUserAgent,
  type RequestLike,
} from '@base/server-kit';
import { InjectDb, type Database } from '../core/database';
import { SettingsService } from '../settings/settings.service';

/** Giữ lịch sử đăng nhập trong bao lâu */
const RETENTION_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

function toDto(row: LoginHistory): LoginHistoryDto {
  const hasLocation = Boolean(row.countryCode || row.country || row.region || row.city);
  return {
    id: row.id,
    app: row.app === 'admin' ? 'admin' : 'user',
    ipAddress: row.ipAddress,
    isPrivateIp: isPrivateIp(row.ipAddress),
    location: hasLocation
      ? { countryCode: row.countryCode, country: row.country, region: row.region, city: row.city }
      : null,
    device: parseUserAgent(row.userAgent),
    userAgent: row.userAgent,
    twoFactorMethod: row.twoFactorMethod,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class LoginHistoryService {
  private lastPurgeAt = 0;

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly settings: SettingsService,
  ) {}

  /** Ghi 1 lần đăng nhập thành công. Lỗi ghi log không được làm hỏng việc đăng nhập. */
  async record(
    userId: string,
    app: AppName,
    req: RequestLike,
    twoFactorMethod?: string,
  ): Promise<void> {
    try {
      const ip = getClientIp(req);
      const headerLocation = getLocationFromHeaders(req);
      const [row] = await this.db
        .insert(loginHistories)
        .values({
          userId,
          app,
          ipAddress: ip,
          userAgent: req.headers.get('user-agent')?.slice(0, 1000) ?? null,
          twoFactorMethod: twoFactorMethod ?? null,
          ...headerLocation,
        })
        .returning({ id: loginHistories.id });

      // Chạy nền, không làm chậm response đăng nhập
      void (async () => {
        // Cloudflare đã bật "Add visitor location headers" thì đủ thành phố, không cần tra ngoài.
        // Mạng Tor: giữ nhãn "Tor", vị trí exit node không có ý nghĩa.
        const complete = Boolean(headerLocation?.city) || headerLocation?.country === 'Tor';
        if (row && ip && !complete && !isPrivateIp(ip)) await this.fillLocation(row.id, ip);
        await this.purgeOld();
      })().catch((error) => logger.warn('Lỗi tác vụ nền lịch sử đăng nhập', error));
    } catch (error) {
      logger.error('Không ghi được lịch sử đăng nhập', error);
    }
  }

  async list(userId: string, { page, pageSize }: { page: number; pageSize: number }) {
    const where = eq(loginHistories.userId, userId);
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(loginHistories)
        .where(where)
        .orderBy(desc(loginHistories.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(loginHistories).where(where),
    ]);
    return { items: rows.map(toDto), meta: { page, pageSize, total: total?.value ?? 0 } };
  }

  /** Tra vị trí theo IP rồi ghi đè vào bản ghi */
  private async fillLocation(id: string, ip: string) {
    if (!(await this.settings.getBoolean('login_geoip_enabled'))) return;
    const location = await lookupIpLocation(ip);
    if (!location) return;
    await this.db.update(loginHistories).set(location).where(eq(loginHistories.id, id));
  }

  /** Xoá bản ghi quá hạn, tối đa 1 lần/giờ */
  private async purgeOld() {
    if (Date.now() - this.lastPurgeAt < PURGE_INTERVAL_MS) return;
    this.lastPurgeAt = Date.now();
    await this.db
      .delete(loginHistories)
      .where(lt(loginHistories.createdAt, new Date(Date.now() - RETENTION_DAYS * DAY_MS)));
  }
}
