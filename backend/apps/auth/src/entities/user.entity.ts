import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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

  //   @OneToMany(() => VehicleEntity, (vehicle) => vehicle.user, {
  //     cascade: true,
  //   })
  //   vehicle: VehicleEntity[];
}
