import { z } from 'zod';

export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100),
  category: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  minRating: z.number().min(0).max(5).optional(),
});

export const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export type SearchInput = z.infer<typeof searchSchema>;
export type ContactInput = z.infer<typeof contactSchema>;

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePrice(price: string): { valid: boolean; value?: number } {
  const num = parseFloat(price);
  if (isNaN(num) || num < 0) {
    return { valid: false };
  }
  return { valid: true, value: num };
}