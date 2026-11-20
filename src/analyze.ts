import { generateText, Output } from 'ai';
import { z } from 'zod';

export const findingSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.enum(['security', 'quality', 'performance', 'reliability']),
  file: z.string(),
  summary: z.string(),
  recommendation: z.string()
});

export const reviewSchema = z.object({
  overallRisk: z.enum(['low', 'medium', 'high']),
  findings: z.array(findingSchema)
});

export type Finding = z.infer<typeof findingSchema>;
export type Review = z.infer<typeof reviewSchema>;

export async function analyzeWithPromptV1(source: string): Promise<string> {
  const model = process.env.REVIEW_MODEL;
  if (!model) {
    throw new Error('REVIEW_MODEL is not set. Add it to .env.');
  }

  const result = await generateText({
    model,
    prompt: `Review this code and tell me what is wrong:\n\n${source}`
  });

  return result.text;
}

export async function analyzeRepository(files: { path: string; content: string }[]): Promise<Review> {
  const model = process.env.REVIEW_MODEL;
  if (!model) {
    throw new Error('REVIEW_MODEL is not set. Add it to .env.');
  }

  const result = await generateText({
    model,
    instructions: `You are a security and quality reviewer.
Only report findings that are supported by the source you are shown.
Give specific, actionable recommendations.
If you find no issues, return an empty findings array.`,
    prompt: files.map((f) => `FILE: ${f.path}\n${f.content}`).join('\n\n'),
    output: Output.object({ schema: reviewSchema })
  });

  return result.output;
}

async function main() {
  const review = await analyzeRepository([
    {
      path: 'src/auth.ts',
      content: `export function login(user: string, password: string) {
  if (password === 'admin') return true;
  return false;
}`
    }
  ]);
  console.log(JSON.stringify(review, null, 2));
}

main();
