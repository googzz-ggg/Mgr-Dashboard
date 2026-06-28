import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
    }

    // Clean messages: only user/assistant roles, non-empty content, strictly alternating
    const rawMessages: { role: string; content: string }[] = body.messages;
    const cleaned: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of rawMessages) {
      if (m.role !== "user" && m.role !== "assistant") continue;
      const content = String(m.content ?? "").trim();
      if (!content) continue;
      // Enforce alternation — skip consecutive same-role messages
      if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === m.role) continue;
      cleaned.push({ role: m.role as "user" | "assistant", content });
    }
    // Must start with user
    if (cleaned.length === 0 || cleaned[0].role !== "user") {
      return NextResponse.json({ error: "First message must be from user" }, { status: 400 });
    }
    // Must end with user (last turn is always the new question)
    const finalMessages = cleaned[cleaned.length - 1].role === "user"
      ? cleaned
      : cleaned.slice(0, -1);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: body.system || "You are Nexus, elite retail intelligence AI.",
        messages: finalMessages,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      console.error("Anthropic API error", response.status, detail);
      // Return 400 details so the client can show a useful message
      return NextResponse.json(
        { error: "Anthropic API error", status: response.status, detail },
        { status: 502 }  // use 502 so client knows it's an upstream error
      );
    }

    // Transform Anthropic SSE → OpenAI-compatible SSE so NexusCopilot client works unchanged
    const encoder = new TextEncoder();
    const transformedStream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data) continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                  const chunk = JSON.stringify({ choices: [{ delta: { content: parsed.delta.text } }] });
                  controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                }
                if (parsed.type === "message_stop") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              } catch {
                // partial chunk — safe to skip
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(transformedStream, {
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
