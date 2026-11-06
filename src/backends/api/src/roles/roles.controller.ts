import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Put } from '@nestjs/common';
import {
  assignPermissionsSchema,
  createRoleSchema,
  idParamSchema,
  listRolesQuerySchema,
  updateRoleSchema,
  type IdParam,
} from '@base/shared';
import type { z } from 'zod';
import { paginated } from '../core/transform.interceptor';
import { RequirePermission, ZodBody, ZodParams, ZodQuery } from '../decorators/customize';
import { RolesService } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // Trang user cũng cần danh sách role để chọn khi gán
  @RequirePermission('roles.list', 'users.list')
  @Get()
  async list(@ZodQuery(listRolesQuerySchema) query: z.infer<typeof listRolesQuerySchema>) {
    return paginated(await this.rolesService.list(query));
  }

  @RequirePermission('roles.create')
  @Post()
  create(@ZodBody(createRoleSchema) input: z.infer<typeof createRoleSchema>) {
    return this.rolesService.create(input);
  }

  @RequirePermission('roles.view')
  @Get(':id')
  get(@ZodParams(idParamSchema) { id }: IdParam) {
    return this.rolesService.getById(id);
  }

  @RequirePermission('roles.update')
  @Patch(':id')
  update(
    @ZodParams(idParamSchema) { id }: IdParam,
    @ZodBody(updateRoleSchema) input: z.infer<typeof updateRoleSchema>,
  ) {
    return this.rolesService.update(id, input);
  }

  @RequirePermission('roles.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@ZodParams(idParamSchema) { id }: IdParam) {
    await this.rolesService.remove(id);
  }

  @RequirePermission('roles.assignPermissions')
  @Put(':id/permissions')
  setPermissions(
    @ZodParams(idParamSchema) { id }: IdParam,
    @ZodBody(assignPermissionsSchema) { permissions }: z.infer<typeof assignPermissionsSchema>,
  ) {
    return this.rolesService.setPermissions(id, permissions);
  }
}
