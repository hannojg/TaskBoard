import { z } from 'zod';
export const issueSchema = z.object({url:z.string().url(),repository:z.string(),number:z.number().int().positive(),title:z.string(),body:z.string(),state:z.enum(['open','closed']),labels:z.array(z.string()),updatedAt:z.string(),fetchedAt:z.string()});
