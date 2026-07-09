import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('products')
export class TypeOrmProduct {
  @PrimaryColumn()
  id: string;

  @Column()
  catalogId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ default: 'draft' })
  status: string;

  @Column()
  createdBy: string;

  @Column('simple-json', { nullable: true })
  attributes?: { id: string; name: string; value: string }[];

  @Column('simple-json', { nullable: true })
  media?: { id: string; url: string; type: string; isPrimary: boolean }[];

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;

  @VersionColumn()
  version: number;
}
