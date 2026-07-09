import { v4 as uuidv4 } from 'uuid';
import { ProductAttribute } from './product-attribute.entity';
import { ProductMedia } from './product-media.entity';

export type ProductStatus = 'draft' | 'published' | 'archived';

export { ProductAttribute, ProductMedia };

export class Product {
  constructor(
    public readonly id: string,
    public catalogId: string,
    public name: string,
    public readonly createdBy: string,
    public description?: string,
    public status: ProductStatus = 'draft',
    public attributes: ProductAttribute[] = [],
    public media: ProductMedia[] = [],
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public version: number = 1,
  ) {}

  publish(): void { this.status = 'published'; this.updatedAt = new Date(); }
  archive(): void { this.status = 'archived'; this.updatedAt = new Date(); }

  updateDetails(name: string, description?: string): void {
    this.name = name;
    if (description !== undefined) this.description = description;
    this.updatedAt = new Date();
  }

  addAttribute(name: string, value: string): ProductAttribute {
    const attr = new ProductAttribute(uuidv4(), name, value);
    this.attributes.push(attr);
    this.updatedAt = new Date();
    return attr;
  }

  removeAttribute(attrId: string): void {
    this.attributes = this.attributes.filter(a => a.id !== attrId);
    this.updatedAt = new Date();
  }

  addMedia(url: string, type: 'image' | 'video', isPrimary?: boolean): ProductMedia {
    const media = new ProductMedia(uuidv4(), url, type, isPrimary ?? false);
    if (isPrimary) {
      this.media.forEach(m => m.isPrimary = false);
    }
    this.media.push(media);
    this.updatedAt = new Date();
    return media;
  }

  removeMedia(mediaId: string): void {
    this.media = this.media.filter(m => m.id !== mediaId);
    this.updatedAt = new Date();
  }
}
