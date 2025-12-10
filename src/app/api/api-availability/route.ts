// src/app/api/ai-availability/route.ts
export const runtime = 'nodejs';

export async function GET() {
  const ok = !!process.env.OPENAI_API_KEY;
  return Response.json({ ok }, { status: 200 });
}