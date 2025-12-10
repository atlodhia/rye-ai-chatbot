import { NextRequest, NextResponse } from 'next/server';
import { ryeRestFetch } from '@/lib/ryeRest';

export async function POST(req: NextRequest) {
  try {
    const { checkoutIntentId, basisTheoryToken } = await req.json();

    if (!checkoutIntentId || !basisTheoryToken) {
      return NextResponse.json(
        { error: 'Missing checkoutIntentId or basisTheoryToken' },
        { status: 400 }
      );
    }

    const r = await ryeRestFetch(
      `/v2/checkout-intents/${checkoutIntentId}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ basisTheoryToken }),
      }
    );

    const text = await r.text();
    if (!r.ok) {
      return NextResponse.json(
        { error: `Rye error ${r.status}: ${text}` },
        { status: 500 }
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error confirming checkout intent:', error);
    return NextResponse.json(
      {
        error: 'Failed to confirm checkout intent',
        details:
          error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}