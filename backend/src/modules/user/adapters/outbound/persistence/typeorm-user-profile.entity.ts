import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('user_profiles')
export class TypeOrmUserProfile {
  @PrimaryColumn()
  userId: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ default: 'inactive' })
  status: string;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;

  @VersionColumn()
  version: number;
}
