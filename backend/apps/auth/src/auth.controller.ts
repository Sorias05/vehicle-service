import { Body, Controller, Get, Post, Req } from '@nestjs/common';

import { Public } from '@app/authlib';

import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: any) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: any, @Req() req: any) {
    const user = await this.authService.validateUser(dto);

    req.session.userId = user.id;

    return {
      message: `Logged in as ${user.email}`,
    };
  }

  @Post('logout')
  logout(@Req() req: any) {
    return new Promise<void>((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  @Get('session')
  getSession(@Req() req: any) {
    const userId = req.session?.userId;

    return {
      authenticated: Boolean(userId),
      userId: userId ?? null,
    };
  }
}
