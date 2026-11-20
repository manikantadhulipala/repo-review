import { generateText } from 'ai';

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

async function main() {
  const source = `
    export function login(user: string, password: string) {
      if (password === 'admin') return true;
      return false;
    }
  `;

  const review = await analyzeWithPromptV1(source);
  console.log(review);
}

main();
