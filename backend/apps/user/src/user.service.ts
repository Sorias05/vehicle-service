import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository, UpdateResult } from 'typeorm';
import { UserEntity } from '@app/database/entities/user.entity';
import { HashService } from './hash.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async register(dto: any) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new BadRequestException('User exists');
    }

    const hashed = HashService.hash(dto.password);

    return this.userRepository.save({
      ...dto,
      password: hashed,
    });
  }

  async validateUser(dto: any) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
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

  async getUsers(): Promise<UserEntity[]> {
    return this.userRepository.find();
  }

  async getUser(id: number): Promise<UserEntity> {
    return this.userRepository.findOne({ where: { id } });
  }

  async putUser(id: number, user: any): Promise<UpdateResult> {
    return this.userRepository.update(id, user);
  }

  async deleteUser(id: number): Promise<DeleteResult> {
    return this.userRepository.delete(id);
  }
}
