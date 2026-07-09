import { IsString, IsOptional } from 'class-validator';

export class CreateProductDto {
  @IsString()
  catalogId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
