// src/app/api/rotd/route.ts
export const runtime = 'nodejs';

/**
 * Minimal ROTD stub.
 * Replace later with your recipe pipeline.
 */
export async function GET() {
  // For now, static. Later: pull from your recipe fetcher.
  const title = 'High-protein Greek yogurt berry bowl';
  const summary =
    'Quick breakfast or snack: Greek yogurt + mixed berries + chia + drizzle of honey. ~25g protein, high fiber, minimal prep.';
  const sourceName = 'Paceline Kitchen';
  const sourceUrl =
    'https://paceline.fit/blog/high-protein-greek-yogurt-berry-bowl'; // ideally a specific PDP/article URL

  return Response.json(
    {
      title,
      summary,
      sourceName,
      sourceUrl,
      dateISO: new Date().toISOString().slice(0, 10),
    },
    { status: 200 }
  );
}