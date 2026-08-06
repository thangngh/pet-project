import { Product } from './product.entity';

const make = () => new Product('p1', 'c1', 'Dog Food', 'admin');

describe('Product', () => {
  it('starts as draft', () => {
    expect(make().status).toBe('draft');
  });

  it('publishes and archives', () => {
    const p = make();
    p.publish();
    expect(p.status).toBe('published');
    p.archive();
    expect(p.status).toBe('archived');
  });

  // The id is supplied by the caller: the domain layer must not import uuid.
  it('takes attribute ids from the caller', () => {
    const p = make();
    const attr = p.addAttribute('a1', 'colour', 'brown');

    expect(attr.id).toBe('a1');
    expect(p.attributes).toHaveLength(1);
    expect(p.attributes[0]).toBe(attr);
  });

  it('removes an attribute by id and leaves the rest', () => {
    const p = make();
    p.addAttribute('a1', 'colour', 'brown');
    p.addAttribute('a2', 'size', 'large');

    p.removeAttribute('a1');

    expect(p.attributes.map((a) => a.id)).toEqual(['a2']);
  });

  it('takes media ids from the caller', () => {
    const p = make();
    const media = p.addMedia('m1', 'http://img/1.png', 'image');

    expect(media.id).toBe('m1');
    expect(media.isPrimary).toBe(false);
  });

  it('demotes the previous primary when a new primary is added', () => {
    const p = make();
    p.addMedia('m1', 'http://img/1.png', 'image', true);
    p.addMedia('m2', 'http://img/2.png', 'image', true);

    expect(p.media.find((m) => m.id === 'm1')!.isPrimary).toBe(false);
    expect(p.media.find((m) => m.id === 'm2')!.isPrimary).toBe(true);
  });

  it('removes media by id', () => {
    const p = make();
    p.addMedia('m1', 'http://img/1.png', 'image');
    p.addMedia('m2', 'http://img/2.png', 'video');

    p.removeMedia('m2');

    expect(p.media.map((m) => m.id)).toEqual(['m1']);
  });

  it('updateDetails keeps the description when none is passed', () => {
    const p = new Product('p1', 'c1', 'Old', 'admin', 'keep me');
    p.updateDetails('New');

    expect(p.name).toBe('New');
    expect(p.description).toBe('keep me');
  });
});
