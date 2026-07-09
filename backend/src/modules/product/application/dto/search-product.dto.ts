import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchProductDto {
  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsString()
  catalogId?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit: number = 20;
}
