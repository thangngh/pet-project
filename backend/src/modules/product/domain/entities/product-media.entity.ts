export class ProductMedia {
  constructor(
    public readonly id: string,
    public url: string,
    public type: 'image' | 'video',
    public isPrimary: boolean = false,
  ) {}
}
