import { z } from 'zod';

export const UISchema = z.object({
  pages: z.array(z.object({
    name: z.string(),
    route: z.string(),
    layout: z.enum(['dashboard', 'form', 'table', 'landing', 'detail']),
    components: z.array(z.object({
      type: z.enum(['table', 'form', 'chart', 'card', 'button', 'nav', 'modal']),
      label: z.string(),
      data_source: z.string().optional(),
      fields: z.array(z.string()).optional(),
      actions: z.array(z.string()).optional()
    }))
  }))
});

export const APISchema = z.object({
  endpoints: z.array(z.object({
    name: z.string(),
    path: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    auth_required: z.boolean(),
    roles_allowed: z.array(z.string()),
    request_body: z.record(z.string()).optional(),
    response_body: z.record(z.string()).optional(),
    db_entity: z.string()
  }))
});

export const DBSchema = z.object({
  tables: z.array(z.object({
    name: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'integer', 'boolean', 'datetime', 'float', 'text', 'uuid']),
      required: z.boolean(),
      unique: z.boolean().optional(),
      foreign_key: z.string().nullable()
    })),
    indexes: z.array(z.string()).optional()
  }))
});

export const AuthSchema = z.object({
  auth_type: z.enum(['jwt', 'session', 'oauth']),
  roles: z.array(z.string()),
  rules: z.array(z.object({
    route: z.string(),
    method: z.string(),
    allowed_roles: z.array(z.string()),
    conditions: z.string().nullable()
  })),
  premium_gates: z.array(z.object({
    feature: z.string(),
    required_plan: z.string()
  }))
});

export const FullSchema = z.object({
  ui: UISchema,
  api: APISchema,
  db: DBSchema,
  auth: AuthSchema
});
