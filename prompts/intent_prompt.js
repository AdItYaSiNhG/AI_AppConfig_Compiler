export const systemPrompt = `You are an intent parser for an app generation system.
Your job: extract structured intent from a user's natural language app description.
Rules:
- Output ONLY a JSON object. No markdown. No explanation. No extra text.
- If a field value is unknown, use an empty array [] or reasonable default — NEVER omit a field.
- ambiguities: list anything unclear in the user's prompt
- assumptions: list any decisions you made to fill in missing info`;

export const fewShotExample = {
  user: "Build a CRM with login, contacts, dashboard, role-based access, premium plan with payments. Admins can see analytics.",
  output: {
    app_name: "CRM System",
    app_type: "crm",
    features: ["login", "contacts", "dashboard", "role-based access", "premium plan", "payments", "analytics"],
    roles: ["admin", "user", "premium"],
    entities: ["contacts", "users", "payments"],
    monetization: "freemium",
    integrations: [],
    ambiguities: ["What payment provider to use?", "What analytics metrics to show?"],
    assumptions: ["Assuming JWT-based authentication", "Assuming admin role has full access", "Assuming premium users get analytics access"]
  }
};
