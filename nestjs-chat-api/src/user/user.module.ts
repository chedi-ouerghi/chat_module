import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StripeService } from 'src/stripe/stripe.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  providers: [UserService, PrismaService, StripeService],
})
export class UserModule {}
