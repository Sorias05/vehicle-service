import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { VehicleEntity } from './vehicle.entity';

@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @OneToMany(() => VehicleEntity, (vehicle) => vehicle.user, {
    cascade: true,
  })
  vehicle: VehicleEntity[];
}
