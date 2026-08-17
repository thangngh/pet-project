import { Entity, Column, PrimaryColumn, VersionColumn, Index } from 'typeorm';

@Entity('products')
export class TypeOrmProduct {
  @PrimaryColumn()
  id: string;

  @Index('IDX_products_catalogId')
  @Column()
  catalogId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Index('IDX_products_status')
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
