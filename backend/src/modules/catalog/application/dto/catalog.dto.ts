export class CatalogDto {
  constructor(
    public id: string,
    public name: string,
    public status: string,
    public parentId?: string,
    public children?: CatalogDto[],
  ) {}
}
