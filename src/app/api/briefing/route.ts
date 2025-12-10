// src/app/api/briefing/route.ts
import { NextResponse } from 'next/server';

/**
 * This route returns:
 * - a small greeting (“Happy Tuesday”, “TGIF”, etc)
 * - a trending wellness story summary + source URL
 * - a few prompts derived from that story
 *
 * For now it’s stubbed. You can later wire this to:
 *  - a news API (Google News / GDELT / NewsAPI / etc)
 *  - or your own curated list
 */
export async function GET() {
  // 👇 Replace this with real indexing later
  const today = new Date();
  const day = today.toLocaleDateString('en-US', { weekday: 'long' });

  const greeting =
    day === 'Friday'
      ? 'TGIF — welcome back.'
      : `Happy ${day.toLowerCase()} — welcome back.`;

  // Stub example topic
  const topic = {
    title: 'New research links short walks to improved metabolic health',
    summary:
      'A new study suggests that adding short, easy walks throughout the day can meaningfully improve blood sugar control and overall metabolic health—especially for people with busy schedules.',
    sourceName: 'Healthline',
    url: 'https://www.healthline.com/',
  };

  const prompts = [
    {
      label: 'Give me the gist',
      text: `Tell me more about "${topic.title}" and why it matters for my fitness.`,
    },
    {
      label: 'Apply to me',
      text:
        'How should I change my weekly routine based on this? Make it practical.',
    },
    {
      label: 'Gear ideas',
      text:
        'Recommend gear that helps me build more walking/rucking into my day.',
    },
    {
      label: 'Plan it',
      text:
        'Build me a simple 4-week plan inspired by this story.',
    },
  ];

  return NextResponse.json({
    greeting,
    title: topic.title,
    summary: topic.summary,
    sourceName: topic.sourceName,
    url: topic.url,
    prompts,
  });
}