export function checkConsistency(schema) {
  const errors = [];

  if (!schema.api || !schema.db || !schema.ui || !schema.auth) {
    return errors;
  }

  for (const endpoint of schema.api.endpoints) {
    const tableExists = schema.db.tables.some(t => t.name === endpoint.db_entity);
    if (!tableExists) {
      errors.push({
        type: 'cross_layer_mismatch',
        layer: 'api',
        message: `Endpoint "${endpoint.name}" references db_entity "${endpoint.db_entity}" which doesn't exist in DB schema`,
        fix_hint: `Add table "${endpoint.db_entity}" to DB schema or correct the db_entity field`
      });
    }
  }

  const endpointNames = schema.api.endpoints.map(e => e.name);
  for (const page of schema.ui.pages) {
    for (const component of page.components) {
      if (component.data_source && !endpointNames.includes(component.data_source)) {
        errors.push({
          type: 'cross_layer_mismatch',
          layer: 'ui',
          message: `Component "${component.label}" on page "${page.name}" references data_source "${component.data_source}" which doesn't exist in API schema`,
          fix_hint: `Create endpoint "${component.data_source}" or update the component's data_source`
        });
      }
    }
  }

  const definedRoles = schema.auth.roles;
  for (const rule of schema.auth.rules) {
    for (const role of rule.allowed_roles) {
      if (!definedRoles.includes(role)) {
        errors.push({
          type: 'missing_field',
          layer: 'auth',
          message: `Role "${role}" used in auth rule for "${rule.route}" is not in the roles list`,
          fix_hint: `Add "${role}" to auth.roles array`
        });
      }
    }
  }

  for (const page of schema.ui.pages) {
    if (page.access && page.access.length > 0) {
      const covered = schema.auth.rules.some(r => r.route === page.route);
      if (!covered) {
        errors.push({
          type: 'missing_field',
          layer: 'auth',
          message: `Page "${page.name}" at route "${page.route}" requires access control but has no auth rule`,
          fix_hint: `Add auth rule for "${page.route}"`
        });
      }
    }
  }

  return errors;
}

export function stage4_refine(context) {
  const schema = context.schema;
  const errors = checkConsistency(schema);
  context.consistencyErrors = errors;
  return errors;
}
