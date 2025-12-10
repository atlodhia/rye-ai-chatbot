import { NextRequest, NextResponse } from 'next/server';
import { ryeRestFetch } from '@/lib/ryeRest';
import type { CreateCheckoutIntentRequest } from '@/lib/rye';

export async function POST(request: NextRequest) {
  try {
    const body: CreateCheckoutIntentRequest = await request.json();

    // Validate required fields
    if (!body.buyer || !body.productUrl || !body.quantity) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: buyer, productUrl, and quantity are required',
        },
        { status: 400 }
      );
    }

    // Validate buyer information
    const { buyer } = body;
    const requiredBuyerFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'address1',
      'city',
      'province',
      'country',
      'postalCode',
    ];

    for (const field of requiredBuyerFields) {
      if (!buyer[field as keyof typeof buyer]) {
        return NextResponse.json(
          { error: `Missing required buyer field: ${field}` },
          { status: 400 }
        );
      }
    }

    // ✅ Call Rye Sell-Anything REST
    const r = await ryeRestFetch('/v2/checkout-intents', {
      method: 'POST',
      body: JSON.stringify(body),
    });

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
    console.error('Error creating checkout intent:', error);

    return NextResponse.json(
      {
        error: 'Failed to create checkout intent',
        details:
          error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}