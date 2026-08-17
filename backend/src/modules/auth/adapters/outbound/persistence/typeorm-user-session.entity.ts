import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_sessions')
export class TypeOrmUserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  refreshTokenHash: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ nullable: true })
  ip?: string;

  @Column()
  createdAt: Date;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  revokedAt?: Date;
}
