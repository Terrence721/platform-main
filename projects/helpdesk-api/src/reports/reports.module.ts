import { ReportsService } from '@helpdesk/server';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportsController } from './reports.controller';

/**
 * The Reports page's figures for supervisors and admins (/api/reports).
 * AuthModule brings the guard every endpoint here is behind; the database
 * comes from the global DatabaseModule.
 */
@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
