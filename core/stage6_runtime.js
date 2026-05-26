function layerMissing(name) {
  return { pass: false, failures: [`${name} schema layer is missing (generation failed)`] };
}

export function runSimulation(schema) {
  const checks = [
    {
      name: 'route_coverage',
      run: () => {
        if (!schema.api || !schema.ui) return layerMissing(!schema.api ? 'api' : 'ui');
        const apiPaths = schema.api.endpoints ? schema.api.endpoints.map(e => e.path) : [];
        const failures = (schema.ui.pages || [])
          .filter(p => p.access && p.access.length > 0)
          .filter(p => !apiPaths.some(path => path.startsWith('/api/' + p.route.split('/')[1])));
        return { pass: failures.length === 0, failures };
      }
    },
    {
      name: 'auth_flow_completeness',
      run: () => {
        if (!schema.api || !schema.auth) return layerMissing(!schema.api ? 'api' : 'auth');
        const hasLoginEndpoint = schema.api.endpoints && schema.api.endpoints.some(e =>
          e.path.includes('login') || e.path.includes('auth')
        );
        const hasJWTOrSession = ['jwt', 'session', 'oauth'].includes(schema.auth.auth_type);
        return { pass: hasLoginEndpoint && hasJWTOrSession, failures: [] };
      }
    },
    {
      name: 'crud_trace',
      run: () => {
        if (!schema.db || !schema.api) return layerMissing(!schema.db ? 'db' : 'api');
        const failures = [];
        for (const table of schema.db.tables || []) {
          const methods = (schema.api.endpoints || [])
            .filter(e => e.db_entity === table.name)
            .map(e => e.method);
          if (!methods.includes('GET')) failures.push(`${table.name}: missing GET`);
          if (!methods.includes('POST')) failures.push(`${table.name}: missing POST`);
        }
        return { pass: failures.length === 0, failures };
      }
    },
    {
      name: 'premium_gating',
      run: () => {
        if (!schema.auth) return layerMissing('auth');
        if (!schema.auth.premium_gates || schema.auth.premium_gates.length === 0) return { pass: true, failures: [] };
        const intentFeatures = schema.intent?.features || [];
        const failures = schema.auth.premium_gates
          .filter(g => !intentFeatures.some(f => f.toLowerCase().includes(g.feature.toLowerCase())));
        return { pass: failures.length === 0, failures };
      }
    },
    {
      name: 'field_mapping_trace',
      run: () => {
        if (!schema.api || !schema.db) return layerMissing(!schema.api ? 'api' : 'db');
        const failures = [];
        for (const endpoint of schema.api.endpoints || []) {
          const table = (schema.db.tables || []).find(t => t.name === endpoint.db_entity);
          if (!table) continue;
          const tableFields = table.fields.map(f => f.name);
          for (const field of Object.keys(endpoint.request_body || {})) {
            if (!tableFields.includes(field) && field !== 'id' && !field.includes('_id')) {
              failures.push(`Endpoint "${endpoint.name}": field "${field}" not in table "${table.name}"`);
            }
          }
        }
        return { pass: failures.length === 0, failures };
      }
    }
  ];

  const results = checks.map(check => {
    let result;
    try {
      result = check.run();
    } catch (e) {
      result = { pass: false, failures: [`${check.name} check threw: ${e.message}`] };
    }
    return {
      name: check.name,
      status: result.pass ? 'pass' : 'fail',
      details: result.pass
        ? `${check.name} check passed`
        : `Failed: ${result.failures.join('; ')}`,
      failures: result.failures
    };
  });

  const passed = results.every(r => r.status === 'pass');
  return {
    passed,
    checks: results,
    total_checks: results.length,
    passed_checks: results.filter(r => r.status === 'pass').length,
    failed_checks: results.filter(r => r.status === 'fail').length
  };
}
