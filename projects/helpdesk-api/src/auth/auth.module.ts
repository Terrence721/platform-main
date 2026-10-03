import { SESSION_HOURS } from '@helpdesk/contract';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { jwtSecret } from './auth-config';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

/**
 * Signing in and out (/api/auth), and AuthGuard for every endpoint that
 * needs a signed-in user.
 */
@Module({
  imports: [
    // A factory, not register(): it runs at start-up, after main.ts has
    // loaded .env, so HELPDESK_JWT_SECRET from .env is the one used.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: jwtSecret(),
        signOptions: { expiresIn: `${SESSION_HOURS}h` },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
