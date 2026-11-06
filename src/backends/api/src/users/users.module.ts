import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoginHistoryModule } from '../login-history/login-history.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, LoginHistoryModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
