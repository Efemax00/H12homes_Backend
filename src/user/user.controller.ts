import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @UseGuards(JwtAuthGuard)
@Get('profile')
async getProfile(@Req() req: any) {
  const user = await this.userService.findById(req.user.sub);
  if (!user) return null;
  
  const { password, ...safeUser } = user;
  return safeUser;
}

}
