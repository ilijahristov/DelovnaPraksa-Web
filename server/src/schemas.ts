import { z } from 'zod';

const email = z
  .string({ error: 'Внесете е-пошта.' })
  .trim()
  .toLowerCase()
  .max(254, 'Е-поштата е предолга.')
  .pipe(z.email('Внесете валидна е-пошта.'));

export const signupSchema = z.object({
  name: z
    .string({ error: 'Внесете име.' })
    .trim()
    .min(2, 'Името мора да има најмалку 2 знаци.')
    .max(100, 'Името е предолго.'),
  email,
  password: z
    .string({ error: 'Внесете лозинка.' })
    .min(8, 'Лозинката мора да има најмалку 8 знаци.')
    .max(72, 'Лозинката може да има најмногу 72 знаци.'),
});

export const loginSchema = z.object({
  email: z.string({ error: 'Внесете е-пошта.' }).trim().toLowerCase().min(1, 'Внесете е-пошта.'),
  password: z.string({ error: 'Внесете лозинка.' }).min(1, 'Внесете лозинка.'),
});

export const courseSchema = z.object({
  code: z
    .string({ error: 'Внесете код.' })
    .trim()
    .toUpperCase()
    .min(2, 'Кодот мора да има најмалку 2 знаци.')
    .max(20, 'Кодот може да има најмногу 20 знаци.')
    .regex(/^[A-Z0-9][A-Z0-9-]*$/, 'Кодот може да содржи само латинични букви, бројки и цртичка.'),
  title: z
    .string({ error: 'Внесете наслов.' })
    .trim()
    .min(3, 'Насловот мора да има најмалку 3 знаци.')
    .max(150, 'Насловот е предолг.'),
  description: z.string().trim().max(2000, 'Описот може да има најмногу 2000 знаци.').default(''),
});

export const courseUpdateSchema = courseSchema.partial();

export const materialSchema = z.object({
  title: z
    .string({ error: 'Внесете наслов.' })
    .trim()
    .min(2, 'Насловот мора да има најмалку 2 знаци.')
    .max(150, 'Насловот е предолг.'),
  // Only http(s): anything else (javascript:, data:) would end up in an href.
  url: z
    .string({ error: 'Внесете линк.' })
    .trim()
    .max(2000, 'Линкот е предолг.')
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Внесете валиден линк што почнува со http:// или https://.'),
});

export const enrollSchema = z.object({
  userId: z.number({ error: 'Изберете студент.' }).int().positive(),
});

export function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && id <= 2_147_483_647 ? id : null;
}

export function searchTerm(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 100) : '';
}
