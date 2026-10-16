import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum FileStatus {
  PENDING = 'pending',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('file')
export class FileEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  key: string;

  @Column()
  originalName: string;

  @Column()
  contentType: string;

  @Column({ type: 'bigint', nullable: true })
  size: number | null;

  @Column({
    type: 'enum',
    enum: FileStatus,
    default: FileStatus.PENDING,
  })
  status: FileStatus;

  //   @ManyToOne(() => UserEntity, (user) => user.vehicle)
  //   @JoinColumn({ name: 'userId' })
  //   user: UserEntity;

  @CreateDateColumn()
  createdAt: Date;
}
