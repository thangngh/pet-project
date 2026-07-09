import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('catalogs')
export class TypeOrmCatalog {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

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
