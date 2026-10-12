import { TAB_NAMES } from './site';

// Distinguish technical references from the marketing pages without lengthening browser tabs.
const DOCS_TAB_NAMES: Record<string, string> = {
  contour: 'Contour docs',
  'model-integrity': 'Integrity docs',
  'adversarial-threats': 'Threats docs',
  'machine-trust': 'Trust docs',
  'security-evidence': 'Evidence docs',
  'application-areas': 'Areas docs',
  defense: 'Defense docs',
  'critical-infrastructure': 'Infra docs',
  'autonomous-systems': 'Autonomy docs',
  government: 'Gov docs',
  integrators: 'Integrate docs',
  'company-and-brands': 'Company docs',
  'security-and-disclosure': 'Security docs',
  'privacy-and-data': 'Privacy docs',
};
export const docsTabTitle = (key: string, fallback: string) => `${DOCS_TAB_NAMES[key] ?? TAB_NAMES[key] ?? fallback} | Vraelis`;
