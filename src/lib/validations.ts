import { z } from 'zod';

export const creatorRegistrationSchema = z.object({
  email: z.string().email('Email adresa nije validna'),
  password: z.string().min(8, 'Lozinka mora imati najmanje 8 karaktera'),
  name: z.string().min(2, 'Ime mora imati najmanje 2 karaktera').max(100),
  bio: z.string().min(10, 'Bio mora imati najmanje 10 karaktera').max(2000),
  location: z.string().min(2, 'Lokacija je obavezna').max(100),
  cityId: z.number().int().positive().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  priceFrom: z.union([z.string(), z.number()]).transform(v => Number(v)),
  categories: z.array(z.string()).optional().default([]),
  platforms: z.array(z.string()).optional().default([]),
  languages: z.array(z.string()).optional().default([]),
  instagram: z.string().max(100).optional().nullable(),
  tiktok: z.string().max(100).optional().nullable(),
  youtube: z.string().max(200).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  // Profilna slika se NE šalje kao base64 u registraciji (lako pređe limit / Vercel body).
  // Dozvoljen je samo kratak URL ili null — upload ide posle kreiranja naloga.
  photo: z
    .string()
    .max(2000, 'Profilna slika je prevelika za registracioni zahtev')
    .optional()
    .nullable(),
  portfolio: z.array(z.any()).optional().default([]),
});

export const businessRegistrationSchema = z.object({
  email: z.string().email('Email adresa nije validna'),
  password: z.string().min(8, 'Lozinka mora imati najmanje 8 karaktera'),
  companyName: z.string().min(2, 'Naziv kompanije mora imati najmanje 2 karaktera').max(200),
  phone: z.string().max(30).optional().nullable(),
  website: z.string().url('URL nije validan').optional().nullable().or(z.literal('')),
  industry: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  cityId: z.number().int().positive().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  // Stripe sessionId - obavezan SAMO dok je PAYMENTS_REQUIRED uključeno (runtime
  // provera u api/auth/register/business/route.ts). Kad je poslat, server retrieves
  // session i validira da je placeno. Nikad ne primamo customer/subscription IDs ili
  // plan iz klijenta - svi izvori istine dolaze iz Stripe API-ja preko ovog sessionId-ja.
  sessionId: z.string().min(10, 'Stripe session ID je obavezan').optional(),
});

export const creatorUpdateSchema = z.object({
  name: z.string().min(2, 'Ime mora imati najmanje 2 karaktera').max(100).optional(),
  bio: z.string().min(10, 'Bio mora imati najmanje 10 karaktera').max(2000).optional(),
  location: z.string().min(2, 'Lokacija je obavezna').max(100).optional(),
  cityId: z.number().int().positive().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  email: z.string().email('Email adresa nije validna').optional(),
  phone: z.string().max(30).optional().nullable(),
  instagram: z.string().max(100).optional().nullable(),
  tiktok: z.string().max(100).optional().nullable(),
  youtube: z.string().max(200).optional().nullable(),
  price_from: z.union([z.string(), z.number()]).transform(v => Number(v)).optional(),
  categories: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  // Base64 data URL do ~5MB (isti limit kao /api/creators/[id]/photo)
  photo: z
    .string()
    .max(7_000_000, 'Profilna slika je prevelika (max ~5MB)')
    .optional()
    .nullable(),
  portfolio: z.array(z.any()).optional(),
  status: z.enum(['pending', 'approved', 'deactivated']).optional(),
}).refine(data => {
  if (data.name !== undefined && data.name.length < 2) return false;
  if (data.bio !== undefined && data.bio.length < 10) return false;
  if (data.location !== undefined && data.location.length < 2) return false;
  return true;
}, { message: 'Obavezna polja ne mogu biti prazna' });

export const businessUpdateSchema = z.object({
  businessId: z.string().uuid('Nevažeći Business ID'),
  companyName: z.string().min(2, 'Naziv kompanije mora imati najmanje 2 karaktera').max(200).optional(),
  phone: z.string().max(30).optional().nullable(),
  website: z.string().url('URL nije validan').optional().nullable().or(z.literal('')),
  industry: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  // Base64 data URL do ~5MB (isti limit kao /api/business/[id]/logo)
  logo: z
    .string()
    .max(7_000_000, 'Logo je prevelik (max ~5MB)')
    .optional()
    .nullable(),
});

export const reviewSchema = z.object({
  businessId: z.string().uuid('Nevažeći Business ID'),
  creatorId: z.string().uuid('Nevažeći Creator ID'),
  rating: z.number().int().min(1, 'Ocena mora biti između 1 i 5').max(5, 'Ocena mora biti između 1 i 5'),
  comment: z.string().max(1000, 'Komentar ne sme biti duži od 1000 karaktera').optional().nullable(),
});

/**
 * Validira podatke pomocu Zod sheme.
 * Vraca { data, error } - ako je error null, data je validna.
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { data: T | null; error: string | null } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return { data: null, error: firstError?.message || 'Nevažeći podaci' };
  }
  return { data: result.data, error: null };
}
