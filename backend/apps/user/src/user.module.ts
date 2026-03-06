import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { SharedModule } from '@app/shared';
import { DatabaseModule } from '@app/database';
import { UserEntity } from '@app/database/entities/user.entity';
import { HashService } from './hash.service';

@Module({
  imports: [
    SharedModule.registerConfig(),
    SharedModule.registerRmq('vehicle'),
    DatabaseModule.registerDatabase([UserEntity]),
  ],
  controllers: [UserController],
  providers: [UserService, HashService],
})
export class UserModule {}
