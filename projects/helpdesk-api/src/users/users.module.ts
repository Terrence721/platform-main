import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Helpdesk accounts for admins (/api/users). AuthModule brings the guard
 * every endpoint here is behind; the database comes from the global
 * DatabaseModule.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
