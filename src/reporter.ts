import type { Finding } from './analyze';
import type { TestFinding } from './test-runner';

export type CombinedReview = {
  overallRisk: 'low' | 'medium' | 'high';
  aiFindings: Finding[];
  testFindings: TestFinding[];
};

const SEVERITY_RANK: Record<Finding['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

// Colour is off in CI so logs stay readable.
const useColor = process.env.CI !== 'true';

function color(code: number, text: string): string {
  return useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

function riskColor(risk: CombinedReview['overallRisk']): (text: string) => string {
  const code = risk === 'high' ? 31 : risk === 'medium' ? 33 : 32;
  return (text) => color(code, text);
}

function severityColor(severity: Finding['severity']): (text: string) => string {
  const code = severity === 'critical' || severity === 'high' ? 31 : severity === 'medium' ? 33 : 90;
  return (text) => color(code, text);
}

export function printReview(review: CombinedReview): void {
  const total = review.aiFindings.length + review.testFindings.length;

  console.log('');
  console.log(`Overall risk: ${riskColor(review.overallRisk)(review.overallRisk.toUpperCase())}`);
  console.log(`Total findings: ${total}`);
  console.log('');

  if (total === 0) {
    console.log('No findings. The repo is clean by both AI and test signals.');
    console.log('');
    return;
  }

  if (review.aiFindings.length > 0) {
    console.log('AI findings:');
    const sorted = [...review.aiFindings].sort(
      (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    );
    for (const f of sorted) {
      console.log(`  ${severityColor(f.severity)(`[${f.severity.toUpperCase()}]`)} ${f.summary} (${f.file})`);
      console.log(`      → ${f.recommendation}`);
    }
    console.log('');
  }

  if (review.testFindings.length > 0) {
    console.log('Test findings:');
    for (const f of review.testFindings) {
      console.log(`  ${severityColor(f.severity)(`[${f.severity.toUpperCase()}]`)} ${f.details}`);
    }
    console.log('');
  }
}
