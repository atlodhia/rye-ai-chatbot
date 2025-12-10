import { NextRequest, NextResponse } from 'next/server';
import { ryeRestFetch } from '@/lib/ryeRest';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checkoutIntentId = searchParams.get('checkoutIntentId');

    if (!checkoutIntentId) {
      return NextResponse.json(
        { error: 'Missing required parameter: checkoutIntentId' },
        { status: 400 }
      );
    }

    const r = await ryeRestFetch(
      `/v2/checkout-intents/${checkoutIntentId}`
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
    console.error('Error fetching checkout intent:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch checkout intent',
        details:
          error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}