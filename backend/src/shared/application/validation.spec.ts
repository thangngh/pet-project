import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ArgumentMetadata } from '@nestjs/common/interfaces';
import { SearchProductDto } from '../../modules/product/application/dto/search-product.dto';
import { RegisterDto } from '../../modules/auth/application/dto/register.dto';

/**
 * The pipe configured exactly as app.module.ts registers it. These DTOs
 * carried class-validator decorators for months with no pipe reading them, so
 * the decorators were documentation. This asserts they are now enforcement.
 */
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

const meta = (metatype: new () => unknown): ArgumentMetadata => ({
  type: 'body',
  metatype,
});

describe('global validation', () => {
  describe('SearchProductDto', () => {
    it('applies defaults when the query string is empty', async () => {
      const result = (await pipe.transform(
        {},
        meta(SearchProductDto),
      )) as SearchProductDto;

      // Without transform these were undefined, and the use case computed
      // (undefined - 1) * undefined = NaN, which reached the SQL as OFFSET NaN.
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('coerces the strings a query string actually delivers', async () => {
      const result = (await pipe.transform(
        { page: '3', limit: '50' },
        meta(SearchProductDto),
      )) as SearchProductDto;

      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
      expect(typeof result.page).toBe('number');
    });

    it('rejects a page below 1 rather than computing a negative offset', async () => {
      await expect(
        pipe.transform({ page: '0' }, meta(SearchProductDto)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a page that is not a number at all', async () => {
      await expect(
        pipe.transform({ page: 'abc' }, meta(SearchProductDto)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('RegisterDto', () => {
    const valid = { email: 'someone@example.com', password: 'Str0ngPass' };

    it('accepts a well-formed registration', async () => {
      await expect(
        pipe.transform(valid, meta(RegisterDto)),
      ).resolves.toMatchObject(valid);
    });

    it('rejects a one-character password', async () => {
      await expect(
        pipe.transform({ ...valid, password: 'a' }, meta(RegisterDto)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a malformed email', async () => {
      await expect(
        pipe.transform({ ...valid, email: 'not-an-email' }, meta(RegisterDto)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an undeclared property instead of silently ignoring it', async () => {
      // `role` was a declared field until PR #3 removed it, which is how a
      // public registration could ask to be an admin. forbidNonWhitelisted
      // means re-adding it by accident now fails loudly.
      await expect(
        pipe.transform({ ...valid, role: 'admin' }, meta(RegisterDto)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
