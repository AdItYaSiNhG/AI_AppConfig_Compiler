import { z } from 'zod';

export const DesignSchema = z.object({
  pages: z.array(z.object({
    name: z.string(),
    route: z.string(),
    access: z.array(z.string()),
    components: z.array(z.string())
  })),
  entities: z.array(z.object({
    name: z.string(),
    description: z.string(),
    relations: z.array(z.object({
      entity: z.string(),
      type: z.enum(['one-to-many', 'many-to-many', 'one-to-one', 'many-to-one'])
    }))
  })),
  auth_strategy: z.enum(['jwt', 'session', 'oauth']),
  roles: z.array(z.object({
    name: z.string(),
    permissions: z.array(z.string())
  })),
  flows: z.array(z.object({
    name: z.string(),
    steps: z.array(z.string())
  }))
});
