import { Entity, Column, PrimaryColumn, VersionColumn, Index } from 'typeorm';

@Entity('catalogs')
export class TypeOrmCatalog {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Index('IDX_catalogs_parentId')
  @Column({ nullable: true })
  parentId?: string;

  @Column({ default: 'active' })
  status: string;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;

  @VersionColumn()
  version: number;
}
