export type TestFinding = {
  severity: 'medium' | 'high';
  category: 'test-failure';
  summary: string;
  details: string;
};

const FAILURE_MARKERS = ['FAIL ', '✕ ', '× '];

export function parseTestFailures(output: string): TestFinding[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => FAILURE_MARKERS.some((marker) => line.startsWith(marker)))
    .map((line) => ({
      severity: 'high' as const,
      category: 'test-failure' as const,
      summary: 'Automated test failure',
      details: line
    }));
}
