import { NextRequest, NextResponse } from "next/server";

// llama-3.3-70b-versatile was deprecated by Groq on 2026-06-17.
// openai/gpt-oss-120b is Groq's recommended replacement: similar quality,
// faster inference, still on the free/dev tier.
const MODEL = "openai/gpt-oss-120b";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing Groq API key" }, { status: 500 });
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: body.system || "You are Nexus, elite retail intelligence AI." },
          ...body.messages,
        ],
        stream: true,
        temperature: 0.6,
        max_tokens: 800,
      }),
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      console.error("Groq API error", response.status, detail);
      return NextResponse.json(
        { error: "Groq API error", status: response.status, detail },
        { status: response.status }
      );
    }

    // Pass the SSE stream straight through to the client unchanged.
    // The client (NexusCopilot) reads this as text/event-stream, not JSON —
    // see the matching fetch logic there.
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Nexus proxy error", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
