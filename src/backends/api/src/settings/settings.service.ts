import { Injectable } from '@nestjs/common';
import { inArray, settings, sql } from '@base/db';
import {
  getSettingDefinition,
  SETTING_DEFINITIONS,
  type ImportSettingsResult,
  type PublicSettings,
  type SettingDefinition,
  type SettingItemDto,
  type SettingName,
  type SettingsExportFile,
} from '@base/shared';
import { badRequest } from '@base/server-kit';
import { InjectDb, type Database } from '../core/database';

/** Cache toàn bộ settings trong bộ nhớ, tự làm mới sau 30 giây hoặc khi có thay đổi */
const CACHE_TTL_MS = 30 * 1000;

const DEFINITIONS = SETTING_DEFINITIONS as readonly SettingDefinition[];

/** Chuẩn hoá + kiểm tra giá trị theo kiểu của key; trả về chuỗi lưu DB */
function normalizeValue(def: SettingDefinition, raw: string | null): string {
  const value = (raw ?? '').trim();
  if (value === '') return '';
  switch (def.type) {
    case 'boolean':
      if (value !== 'true' && value !== 'false') throw badRequest('settings.invalidValue', { name: def.name });
      return value;
    case 'number':
      if (!Number.isFinite(Number(value))) throw badRequest('settings.invalidValue', { name: def.name });
      return String(Number(value));
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw badRequest('settings.invalidValue', { name: def.name });
      return value;
    case 'url':
      if (!URL.canParse(value)) throw badRequest('settings.invalidValue', { name: def.name });
      return value;
    default:
      return raw ?? '';
  }
}

@Injectable()
export class SettingsService {
  private cache?: { values: Map<string, string | null>; loadedAt: number };

  constructor(@InjectDb() private readonly db: Database) {}

  private async loadValues(): Promise<Map<string, string | null>> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) return this.cache.values;
    const rows = await this.db.select({ name: settings.name, value: settings.value }).from(settings);
    const values = new Map(rows.map((r) => [r.name, r.value]));
    this.cache = { values, loadedAt: Date.now() };
    return values;
  }

  private invalidate() {
    this.cache = undefined;
  }

  private async upsertMany(entries: { name: string; value: string }[]) {
    if (!entries.length) return;
    await this.db
      .insert(settings)
      .values(entries)
      .onConflictDoUpdate({
        target: settings.name,
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      });
  }

  /** Giá trị dạng chuỗi; chưa có trong DB thì lấy giá trị mặc định */
  async getString(name: SettingName): Promise<string> {
    const value = (await this.loadValues()).get(name);
    return value ?? getSettingDefinition(name)?.defaultValue ?? '';
  }

  async getBoolean(name: SettingName): Promise<boolean> {
    return (await this.getString(name)).trim().toLowerCase() === 'true';
  }

  async getNumber(name: SettingName): Promise<number> {
    const value = Number(await this.getString(name));
    return Number.isFinite(value) ? value : Number(getSettingDefinition(name)?.defaultValue ?? 0);
  }

  async getPublic(): Promise<PublicSettings> {
    return {
      site_name: await this.getString('site_name'),
      allow_registration: await this.getBoolean('allow_registration'),
      require_email_verification: await this.getBoolean('require_email_verification'),
      turnstile_site_key: await this.getString('turnstile_site_key'),
      google_login_enabled: Boolean(
        (await this.getString('google_client_id')) && (await this.getString('google_client_secret')),
      ),
    };
  }

  /** Toàn bộ key hệ thống kèm giá trị (key bí mật không trả giá trị) */
  async list(): Promise<SettingItemDto[]> {
    const rows = await this.db
      .select()
      .from(settings)
      .where(
        inArray(
          settings.name,
          DEFINITIONS.map((d) => d.name),
        ),
      );
    const byName = new Map(rows.map((r) => [r.name, r]));
    return DEFINITIONS.map((d) => {
      const row = byName.get(d.name);
      const value = row?.value ?? d.defaultValue;
      return {
        ...d,
        value: d.isSecret ? null : value,
        configured: Boolean(row?.value),
        updatedAt: row?.updatedAt.toISOString() ?? null,
      };
    });
  }

  /** Lưu các key được gửi lên (key không phải key hệ thống thì báo lỗi) */
  async update(values: Record<string, string | null>): Promise<SettingItemDto[]> {
    const entries = Object.entries(values).map(([name, raw]) => {
      const def = getSettingDefinition(name);
      if (!def) throw badRequest('settings.unknownKey', { name });
      return { name, value: normalizeValue(def, raw) };
    });
    await this.upsertMany(entries);
    this.invalidate();
    return this.list();
  }

  async exportAll(includeSecrets: boolean): Promise<SettingsExportFile> {
    const values = await this.loadValues();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      includeSecrets,
      settings: DEFINITIONS.filter((d) => includeSecrets || !d.isSecret).map((d) => ({
        name: d.name,
        value: values.get(d.name) ?? d.defaultValue,
      })),
    };
  }

  /** Import hàng loạt: chỉ nhận key hệ thống, giá trị sai kiểu thì báo lỗi cả file */
  async importMany(
    items: { name: string; value: string | null }[],
    overwrite: boolean,
  ): Promise<ImportSettingsResult> {
    // Key trùng trong file: lấy giá trị cuối cùng
    const unique = [...new Map(items.map((i) => [i.name, i])).values()];
    const unknown = unique.filter((i) => !getSettingDefinition(i.name)).map((i) => i.name);
    const known = unique
      .filter((i) => getSettingDefinition(i.name))
      .map((i) => ({ name: i.name, value: normalizeValue(getSettingDefinition(i.name)!, i.value) }));

    this.invalidate();
    const current = await this.loadValues();
    const summary: ImportSettingsResult = { created: 0, updated: 0, skipped: 0, unknown };
    const toWrite: { name: string; value: string }[] = [];
    for (const item of known) {
      const existing = current.get(item.name);
      if (existing === undefined || existing === null || existing === '') {
        if (item.value === '' && existing !== undefined) summary.skipped++;
        else {
          toWrite.push(item);
          summary.created++;
        }
      } else if (overwrite && existing !== item.value) {
        toWrite.push(item);
        summary.updated++;
      } else {
        summary.skipped++;
      }
    }
    await this.upsertMany(toWrite);
    this.invalidate();
    return summary;
  }
}
