export class Catalog {
  constructor(
    public readonly id: string,
    public name: string,
    public parentId?: string,
    public status: 'active' | 'archived' = 'active',
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public version: number = 1,
  ) {}

  updateName(name: string): void {
    this.name = name;
    this.updatedAt = new Date();
  }

  archive(): void {
    this.status = 'archived';
    this.updatedAt = new Date();
  }
}
