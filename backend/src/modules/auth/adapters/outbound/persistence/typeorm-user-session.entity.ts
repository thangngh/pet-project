import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('user_sessions')
export class TypeOrmUserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_user_sessions_userId')
  @Column()
  userId: string;

  @Index('IDX_user_sessions_refreshTokenHash')
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
