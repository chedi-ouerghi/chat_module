import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StripeService } from 'src/stripe/stripe.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  async getUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
      },
    });
    return users;
  }

  async getUser({ userId }: { userId: string }) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        stripeAccountId: true,
      },
    });

    let canReceiveMoney = false;
    if (user.stripeAccountId) {
      const stripeAccountData = await this.stripe.getStripeAccount({
        stripeAccountId: user.stripeAccountId,
      });
      canReceiveMoney = stripeAccountData.canReceiveMoney;
    }
    return { ...user, canReceiveMoney };
  }
}
