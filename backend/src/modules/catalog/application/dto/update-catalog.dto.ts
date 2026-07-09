import { IsString } from 'class-validator';

export class UpdateCatalogDto {
  @IsString()
  name: string;
}
