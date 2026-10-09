import { AttachmentsService, IMAGE_RE_ENCODER } from '@helpdesk/server';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttachmentsController } from './attachments.controller';
import { SharpReEncoder } from './sharp-re-encoder';

/**
 * The files customers add to their requests (#1026): their downloads
 * (/api/attachments) and a ticket's list (/api/tickets/:id/attachments),
 * and one AttachmentsService for the whole API, which redraws images with
 * sharp. The service takes its re-encoder as optional, as the demo brings
 * its own, so this module is where the API's is given: without it every
 * image would be refused. AuthModule brings the guard the routes are
 * behind; the database comes from the global DatabaseModule.
 */
@Module({
  imports: [AuthModule],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    { provide: IMAGE_RE_ENCODER, useClass: SharpReEncoder },
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
