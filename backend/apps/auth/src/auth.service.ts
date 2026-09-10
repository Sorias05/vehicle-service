import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserEntity } from '@app/database/entities/user.entity';

import { HashService } from './hash.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async register(dto: { name: string; email: string; password: string }) {
    const existing = await this.userRepository.findOne({
      where: {
        email: dto.email,
      },
    });

    if (existing) {
      throw new UnauthorizedException('User exists');
    }

    const password = HashService.hash(dto.password);

    const user = await this.userRepository.save({
      ...dto,
      password,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }

  async validateUser(dto: { email: string; password: string }) {
    const user = await this.userRepository.findOne({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isValid = HashService.compare(dto.password, user.password);

    if (!isValid) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
