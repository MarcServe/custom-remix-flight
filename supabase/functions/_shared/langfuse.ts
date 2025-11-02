// Langfuse REST API integration for proper observability
// Using direct HTTP calls instead of SDK for Deno compatibility

interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
}

let config: LangfuseConfig | null = null;

function getLangfuseConfig(): LangfuseConfig | null {
  if (config) return config;
  
  const secretKey = Deno.env.get('LANGFUSE_SECRET_KEY');
  const publicKey = Deno.env.get('LANGFUSE_PUBLIC_KEY');
  
  if (!secretKey || !publicKey) {
    console.warn('⚠️ Langfuse keys not configured - tracing will be logged to console only');
    return null;
  }
  
  config = {
    secretKey,
    publicKey,
    baseUrl: "https://cloud.langfuse.com",
  };
  
  console.log('✅ Langfuse configured');
  return config;
}

async function sendToLangfuse(endpoint: string, body: any) {
  const cfg = getLangfuseConfig();
  if (!cfg) return;
  
  try {
    const auth = btoa(`${cfg.publicKey}:${cfg.secretKey}`);
    const response = await fetch(`${cfg.baseUrl}/api/public/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Langfuse API error (${endpoint}):`, response.status, errorText);
    }
  } catch (error) {
    console.error(`Failed to send to Langfuse (${endpoint}):`, error);
  }
}

export function createTrace(name: string, userId?: string, metadata?: any) {
  const traceId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Send trace creation to Langfuse
  sendToLangfuse('traces', {
    id: traceId,
    name,
    userId,
    metadata,
    timestamp,
  }).catch(e => console.error('Trace creation failed:', e));
  
  console.log('✅ Langfuse trace created:', { traceId, name });
  
  return {
    id: traceId,
    name,
    userId,
    metadata,
    timestamp,
  };
}

export function createSpan(trace: any, name: string, input?: any) {
  const spanId = crypto.randomUUID();
  const startTime = new Date();
  
  // Send span creation to Langfuse
  sendToLangfuse('spans', {
    id: spanId,
    traceId: trace.id,
    name,
    startTime: startTime.toISOString(),
    input,
    metadata: {
      traceName: trace.name,
    },
  }).catch(e => console.error('Span creation failed:', e));
  
  console.log('✅ Langfuse span created:', { spanId, name, traceId: trace.id });
  
  return {
    id: spanId,
    traceId: trace.id,
    name,
    input,
    startTime,
  };
}

export async function endSpan(span: any, output?: any, error?: any) {
  const endTime = new Date();
  const duration = span.startTime ? endTime.getTime() - span.startTime.getTime() : 0;
  
  // Update span with end time and output
  await sendToLangfuse('spans', {
    id: span.id,
    traceId: span.traceId,
    name: span.name,
    startTime: span.startTime.toISOString(),
    endTime: endTime.toISOString(),
    output,
    level: error ? 'ERROR' : 'DEFAULT',
    statusMessage: error?.message,
  });
  
  console.log('✅ Langfuse span ended:', { spanId: span.id, name: span.name, duration });
}

export function logGeneration(name: string, model: string, input: any, output: any, usage: any) {
  const traceId = crypto.randomUUID();
  const generationId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Create trace first
  sendToLangfuse('traces', {
    id: traceId,
    name,
    timestamp,
  }).catch(e => console.error('Trace creation failed:', e));
  
  // Send generation to Langfuse
  sendToLangfuse('generations', {
    id: generationId,
    traceId,
    name,
    startTime: timestamp,
    endTime: timestamp,
    model,
    modelParameters: {
      temperature: input.temperature,
      maxTokens: input.max_tokens,
    },
    input,
    output,
    usage: {
      promptTokens: usage?.promptTokens || usage?.prompt_tokens || 0,
      completionTokens: usage?.completionTokens || usage?.completion_tokens || 0,
      totalTokens: (usage?.promptTokens || usage?.prompt_tokens || 0) + (usage?.completionTokens || usage?.completion_tokens || 0),
    },
    metadata: {
      provider: usage?.provider,
    },
  }).catch(e => console.error('Generation logging failed:', e));
  
  console.log('✅ Langfuse generation logged:', { generationId, name, model, traceId });
  
  return {
    id: traceId,
    generationId,
  };
}
