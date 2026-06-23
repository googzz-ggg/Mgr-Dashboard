import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY;
  return NextResponse.json({
    hasKey: !!key,
    keyPreview: key ? key.substring(0, 20) + "..." : null,
    length: key ? key.length : 0
  });
}