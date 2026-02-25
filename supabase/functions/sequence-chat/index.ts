import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Clean API key - removes any non-ASCII characters that cause ByteString errors
 */
function cleanApiKey(key: string | undefined): string | null {
  if (!key) return null;
  return key.trim().replace(/[^\x00-\x7F]/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, extractedParams = {} } = await req.json();
    const rawKey = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_API_KEY = cleanApiKey(rawKey);
    
    if (!OPENAI_API_KEY || !OPENAI_API_KEY.startsWith('sk-')) {
      throw new Error("OPENAI_API_KEY is not configured or invalid. Please add it in Supabase Edge Function Secrets.");
    }

    const authHeader = req.headers.get('Authorization');
    console.log('Starting sequence chat with messages:', messages.length);
    console.log('Current extracted params:', extractedParams);

    // Build system prompt
    const systemPrompt = `You are an AI assistant helping users create personalized email sequences for sales outreach.

Your job is to:
1. Have a natural conversation about what kind of sequence they want
2. Extract key parameters: industry, geography, company size, tone (professional/casual/technical), and number of steps
3. When you have enough information, use the generate_sequence tool to create the sequence

Current extracted parameters: ${JSON.stringify(extractedParams)}

Be conversational and helpful. Ask clarifying questions if needed.`;

    // Prepare API body
    const body: any = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      stream: true,
      tools: [
        {
          type: "function",
          function: {
            name: "generate_sequence",
            description: "Generate an email sequence when all required parameters are collected",
            parameters: {
              type: "object",
              properties: {
                industry: { 
                  type: "string",
                  description: "Industry of target companies (e.g., 'Fintech', 'SaaS', 'Healthcare')"
                },
                geography: { 
                  type: "string",
                  description: "Geographic region (e.g., 'United Kingdom', 'North America', 'Europe')"
                },
                size: { 
                  type: "string",
                  description: "Company size range (e.g., '1-10', '11-50', '51-200', '201-500', '500+')"
                },
                tone: { 
                  type: "string",
                  enum: ["professional", "casual", "technical"],
                  description: "Tone of the emails"
                },
                steps: { 
                  type: "integer",
                  description: "Number of email steps (3-5)",
                  minimum: 3,
                  maximum: 5
                }
              },
              required: ["industry", "geography", "size", "tone", "steps"],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: "auto"
    };

    console.log('Calling OpenAI API...');

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401 || response.status === 402) {
        return new Response(
          JSON.stringify({ error: "OpenAI API key invalid or billing issue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let toolCallArgs = '';
        let isToolCall = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              if (!line.startsWith('data: ')) continue;

              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;

                // Handle tool calls
                if (delta?.tool_calls) {
                  isToolCall = true;
                  const toolCall = delta.tool_calls[0];
                  if (toolCall?.function?.arguments) {
                    toolCallArgs += toolCall.function.arguments;
                  }
                }

                // Handle content
                if (delta?.content && !isToolCall) {
                  const message = `data: ${JSON.stringify({ content: delta.content })}\n\n`;
                  controller.enqueue(encoder.encode(message));
                }

                // Handle finish reason
                if (parsed.choices?.[0]?.finish_reason === 'tool_calls' && toolCallArgs) {
                  try {
                    const params = JSON.parse(toolCallArgs);
                    console.log('Tool call completed with params:', params);
                    
                    // Send extracted params to client
                    const paramsMessage = `data: ${JSON.stringify({ params })}\n\n`;
                    controller.enqueue(encoder.encode(paramsMessage));

                    // Now call the generate-sequence function
                    const supabase = createClient(
                      Deno.env.get('SUPABASE_URL') ?? '',
                      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                    );

                    const { data: sequenceData, error: sequenceError } = await supabase.functions.invoke(
                      'generate-sequence',
                      {
                        body: {
                          ...params,
                          provider: 'openai',
                          model: 'gpt-4o-mini'
                        },
                        ...(authHeader && { headers: { Authorization: authHeader } })
                      }
                    );

                    if (sequenceError) {
                      console.error('Error generating sequence:', sequenceError);
                      const errorMsg = `data: ${JSON.stringify({ 
                        content: `\n\nSorry, I encountered an error generating the sequence: ${sequenceError.message}` 
                      })}\n\n`;
                      controller.enqueue(encoder.encode(errorMsg));
                    } else {
                      console.log('Sequence generated successfully');
                      const successMsg = `data: ${JSON.stringify({ 
                        content: `\n\n✨ Great! I've generated your ${params.steps}-step email sequence for ${params.industry} companies in ${params.geography}. You can see it below!`,
                        sequence: sequenceData
                      })}\n\n`;
                      controller.enqueue(encoder.encode(successMsg));
                    }
                  } catch (e) {
                    console.error('Error parsing tool call arguments:', e);
                  }
                }
              } catch (e) {
                console.error('Error parsing line:', e);
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          console.error('Stream error:', error);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('sequence-chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
