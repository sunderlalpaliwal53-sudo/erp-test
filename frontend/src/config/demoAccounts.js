// Demo account presets for the login screen "click-to-fill" helper.
// These are seeded demo accounts from real_seed.py — not "secrets" in any
// meaningful sense: super_admin / accountant use documented seed credentials,
// and parents log in with mobile + last-6-digits-of-mobile.
//
// The demo panel is disabled by default (REACT_APP_SHOW_DEMO_ACCOUNTS="false"
// in the deployed .env). To render it locally for testing, set the env var
// to "true". To override with your own accounts (for a fork/demo tenant),
// point REACT_APP_DEMO_ACCOUNTS_JSON at a JSON array of
// {role, email, password} objects.
const DEFAULT_DEMO = [
  {
    id: 'super',
    role: 'Super Admin',
    email: process.env.REACT_APP_DEMO_SUPERADMIN_EMAIL || 'superadmin@stanvard.school',
    password: process.env.REACT_APP_DEMO_SUPERADMIN_PASSWORD || '',
  },
  {
    id: 'accountant',
    role: 'Accountant (Kanpur)',
    email: process.env.REACT_APP_DEMO_ACCOUNTANT_EMAIL || 'accountant@stanvard.school',
    password: process.env.REACT_APP_DEMO_ACCOUNTANT_PASSWORD || '',
  },
];

export const DEMO_ACCOUNTS_ENABLED = String(process.env.REACT_APP_SHOW_DEMO_ACCOUNTS ?? 'false') !== 'false';

export function getDemoAccounts() {
  if (!DEMO_ACCOUNTS_ENABLED) return [];
  const override = process.env.REACT_APP_DEMO_ACCOUNTS_JSON;
  if (override) {
    try {
      const parsed = JSON.parse(override);
      if (Array.isArray(parsed)) {
        return parsed.map((a, i) => ({
          id: a.id || `demo-${i}`,
          role: a.role || 'User',
          email: a.email,
          password: a.password,
        }));
      }
    } catch (_e) {
      // fall through to default
    }
  }
  // Filter out entries with empty password (no env var supplied).
  return DEFAULT_DEMO.filter((a) => a.email && a.password);
}
