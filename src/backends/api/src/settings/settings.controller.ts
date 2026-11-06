import { Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { exportSettingsQuerySchema, importSettingsSchema, updateSettingsSchema } from '@base/shared';
import type { z } from 'zod';
import type { Principal } from '../auth/principal';
import {
  CurrentPrincipal,
  Public,
  RequirePermission,
  ZodBody,
  ZodQuery,
} from '../decorators/customize';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Cài đặt công khai cho frontend (tên site, cho phép đăng ký, captcha, Google...) */
  @Public()
  @Get('public')
  getPublic() {
    return this.settingsService.getPublic();
  }

  @RequirePermission('settings.list')
  @Get()
  list() {
    return this.settingsService.list();
  }

  @RequirePermission('settings.update')
  @Put()
  update(@ZodBody(updateSettingsSchema) { values }: z.infer<typeof updateSettingsSchema>) {
    return this.settingsService.update(values);
  }

  @RequirePermission('settings.export')
  @Get('export')
  export(
    @ZodQuery(exportSettingsQuerySchema) { includeSecrets }: z.infer<typeof exportSettingsQuerySchema>,
    @CurrentPrincipal() principal: Principal,
  ) {
    // Chỉ người có quyền sửa cài đặt mới được xuất kèm giá trị bí mật
    return this.settingsService.exportAll(includeSecrets && principal.can('settings.update'));
  }

  @RequirePermission('settings.import')
  @HttpCode(HttpStatus.OK)
  @Post('import')
  import(
    @ZodBody(importSettingsSchema) { settings, overwrite }: z.infer<typeof importSettingsSchema>,
  ) {
    return this.settingsService.importMany(settings, overwrite);
  }
}
