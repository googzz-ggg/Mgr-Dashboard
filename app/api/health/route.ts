import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. Parse the incoming request data
    const body = await request.json();

    // 2. Make the request to OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://your-app.vercel.app",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet", 
        messages: [{ role: "system", content: body.system }, ...body.messages],
        stream: true,
      })
    });

    // 3. Check if OpenRouter returned an error
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    // 4. Return the streaming response or text response
    // If you are using standard non-streaming, you could do: const data = await response.json(); return NextResponse.json(data);
    return new NextResponse(response.body, {
      headers: { "Content-Type": "text/event-stream" },
    });

  } catch (error: any) {
    console.error("Error in health route:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}