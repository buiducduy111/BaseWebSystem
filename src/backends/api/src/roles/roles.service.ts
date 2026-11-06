import { Injectable } from '@nestjs/common';
import {
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  permissions,
  rolePermissions,
  roles,
  users,
  type Role,
} from '@base/db';
import type {
  createRoleSchema,
  listRolesQuerySchema,
  PermissionKey,
  RoleDto,
  updateRoleSchema,
} from '@base/shared';
import { conflict, forbidden, notFound } from '@base/server-kit';
import type { z } from 'zod';
import { InjectDb, type Database } from '../core/database';

type ListQuery = z.infer<typeof listRolesQuerySchema>;
type CreateInput = z.infer<typeof createRoleSchema>;
type UpdateInput = z.infer<typeof updateRoleSchema>;

@Injectable()
export class RolesService {
  constructor(@InjectDb() private readonly db: Database) {}

  /** Gắn danh sách quyền và số user cho các role */
  private async hydrate(rows: Role[]): Promise<RoleDto[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [perms, counts] = await Promise.all([
      this.db
        .select({ roleId: rolePermissions.roleId, key: permissions.key })
        .from(rolePermissions)
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
        .where(inArray(rolePermissions.roleId, ids)),
      this.db
        .select({ roleId: users.roleId, value: count() })
        .from(users)
        .where(inArray(users.roleId, ids))
        .groupBy(users.roleId),
    ]);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isActive: r.isActive,
      isSystem: r.isSystem,
      permissions: perms.filter((p) => p.roleId === r.id).map((p) => p.key as PermissionKey),
      userCount: counts.find((c) => c.roleId === r.id)?.value ?? 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  private async findOrThrow(id: string): Promise<Role> {
    const [role] = await this.db.select().from(roles).where(eq(roles.id, id));
    if (!role) throw notFound('roles.notFound');
    return role;
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const [existing] = await this.db.select({ id: roles.id }).from(roles).where(eq(roles.name, name));
    if (existing && existing.id !== exceptId) throw conflict('roles.nameExists');
  }

  async list({ page, pageSize, search, sortBy, sortOrder }: ListQuery) {
    const where = search
      ? or(ilike(roles.name, `%${search}%`), ilike(roles.description, `%${search}%`))
      : undefined;
    const column = sortBy === 'name' ? roles.name : roles.createdAt;
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(roles)
        .where(where)
        .orderBy((sortOrder === 'asc' ? asc : desc)(column))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(roles).where(where),
    ]);
    return { items: await this.hydrate(rows), meta: { page, pageSize, total: total?.value ?? 0 } };
  }

  async getById(id: string): Promise<RoleDto> {
    const [dto] = await this.hydrate([await this.findOrThrow(id)]);
    return dto!;
  }

  async create(input: CreateInput) {
    await this.assertNameFree(input.name);
    const [role] = await this.db
      .insert(roles)
      .values({ name: input.name, description: input.description ?? null, isActive: input.isActive })
      .returning();
    return this.getById(role!.id);
  }

  async update(id: string, input: UpdateInput) {
    const role = await this.findOrThrow(id);
    if (role.isSystem && ((input.name && input.name !== role.name) || input.isActive === false)) {
      throw forbidden('roles.systemRole');
    }
    if (input.name) await this.assertNameFree(input.name, id);
    await this.db.update(roles).set(input).where(eq(roles.id, id));
    return this.getById(id);
  }

  async remove(id: string) {
    const role = await this.findOrThrow(id);
    if (role.isSystem) throw forbidden('roles.systemRole');
    const [usage] = await this.db
      .select({ value: count() })
      .from(users)
      .where(eq(users.roleId, id));
    if (usage?.value) throw conflict('roles.inUse', { count: usage.value });
    await this.db.delete(roles).where(eq(roles.id, id));
  }

  /** Thay toàn bộ quyền của role bằng danh sách mới */
  async setPermissions(id: string, keys: PermissionKey[]) {
    await this.findOrThrow(id);
    await this.db.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
      if (!keys.length) return;
      const rows = await tx
        .select({ id: permissions.id })
        .from(permissions)
        .where(inArray(permissions.key, keys));
      if (rows.length) {
        await tx.insert(rolePermissions).values(rows.map((p) => ({ roleId: id, permissionId: p.id })));
      }
    });
    return this.getById(id);
  }
}
