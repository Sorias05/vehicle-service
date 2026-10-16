import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('vehicle')
export class VehicleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  brand: string;

  @Column()
  model: string;

  @Column()
  year?: number;

  //   @ManyToOne(() => UserEntity, (user) => user.vehicle)
  //   @JoinColumn({ name: 'userId' })
  //   user: UserEntity;
}
