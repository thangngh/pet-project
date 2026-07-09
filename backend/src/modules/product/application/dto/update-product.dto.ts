import { IsString, IsOptional } from 'class-validator';

export class UpdateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
