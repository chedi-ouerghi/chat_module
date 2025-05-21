import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppGateway } from './app.gateway';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { SocketModule } from './socket/socket.module';
import { StripeModule } from './stripe/stripe.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(8000),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
      }),
    }),
    UserModule,
    AuthModule,
    ChatModule,
    SocketModule,
    StripeModule,
  ],
  providers: [AppGateway],
})
export class AppModule {}
