import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  // localhost:3000/users
  getUsers() {
    return this.userService.getUsers();
  }

  @Get('/:userId')
  // localhost:3000/users/3000
  getUser(@Param('userId') userId: string) {
    return this.userService.getUser({
      userId,
    });
  }
}
