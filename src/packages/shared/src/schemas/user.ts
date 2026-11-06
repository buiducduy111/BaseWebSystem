import { z } from 'zod';
import { LOCALES, type Locale } from '../constants/locales';
import type { PermissionKey } from '../constants/permissions';
import {
  nameSchema,
  paginationQuerySchema,
  passwordSchema,
  sortOrderSchema,
  type PageQuery,
} from './common';

export const USER_SORT_FIELDS = ['email', 'firstName', 'createdAt', 'lastLoginAt'] as const;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(255).optional(),
  status: z.enum(['active', 'locked']).optional(),
  emailVerification: z.enum(['verified', 'unverified']).optional(),
  roleId: z.uuid().optional(),
  sortBy: z.enum(USER_SORT_FIELDS).default('createdAt'),
  sortOrder: sortOrderSchema,
});

export const createUserSchema = z.object({
  email: z.email().max(255),
  firstName: nameSchema,
  lastName: nameSchema,
  password: passwordSchema,
  roleId: z.uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  isSuperAdmin: z.boolean().default(false),
});

export const updateUserSchema = z
  .object({
    email: z.email().max(255),
    firstName: nameSchema,
    lastName: nameSchema,
    roleId: z.uuid().nullable(),
    isActive: z.boolean(),
    isSuperAdmin: z.boolean(),
    emailVerified: z.boolean(),
    lang: z.enum(LOCALES),
  })
  .partial();

export type CreateUserInput = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface ListUsersQuery extends PageQuery {
  status?: 'active' | 'locked';
  emailVerification?: 'verified' | 'unverified';
  roleId?: string;
}

export interface RoleRef {
  id: string;
  name: string;
}

/** Dữ liệu user trả về cho client (không bao giờ chứa mật khẩu / secret) */
export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  lang: Locale;
  isActive: boolean;
  isSuperAdmin: boolean;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  /** false với tài khoản tạo qua Google chưa từng đặt mật khẩu */
  hasPassword: boolean;
  /** Đã liên kết tài khoản Google */
  googleLinked: boolean;
  role: RoleRef | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** User đang đăng nhập, kèm danh sách quyền */
export interface MeDto extends UserDto {
  permissions: PermissionKey[];
  /** Hệ thống bắt buộc xác minh email và user chưa xác minh → chỉ được dùng trang xác minh */
  emailVerificationRequired: boolean;
}

export interface ResetUserPasswordResult {
  password: string;
}

/** Họ tên đầy đủ: tiếng Việt "Họ Tên", tiếng Anh "First Last" */
export function fullName(user: Pick<UserDto, 'firstName' | 'lastName'>, locale: Locale = 'en'): string {
  const parts = locale === 'vi' ? [user.lastName, user.firstName] : [user.firstName, user.lastName];
  return parts.filter(Boolean).join(' ');
}
