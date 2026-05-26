import { z } from 'zod';

export const IntentSchema = z.object({
  app_name: z.string(),
  app_type: z.enum(['crm', 'ecommerce', 'saas', 'dashboard', 'social', 'marketplace', 'other']),
  features: z.array(z.string()),
  roles: z.array(z.string()),
  entities: z.array(z.string()),
  monetization: z.enum(['free', 'freemium', 'paid', 'subscription', 'none']),
  integrations: z.array(z.string()),
  ambiguities: z.array(z.string()),
  assumptions: z.array(z.string())
});
