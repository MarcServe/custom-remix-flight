import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { logGeneration } from '../_shared/langfuse.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIProviderRequest {
  provider?: 'lovable' | 'openai' | 'perplexity';
  model?: string;
  messages: Array<{ role: string; content: string }>;
  tools?: any[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  traceId?: string;
  userId?: string;
}

interface AIProviderResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  model: string;
  provider: string;
  traceId: string;
  traceUrl: string;
}

function calculateCost(provider: string, tokens: number, model?: string): number {
  const pricing: Record<string, Record<string, number>> = {
    lovable: {
      'google/gemini-2.5-flash': 0.000001 * tokens,
      'google/gemini-2.5-pro': 0.000005 * tokens,
    },
    openai: {
      'gpt-4o-mini': (tokens / 1_000_000) * 0.150,
      'gpt-4o': (tokens / 1_000_000) * 5.00,
      'gpt-5-mini': (tokens / 1_000_000) * 0.300,
    },
    perplexity: {
      'sonar': (tokens / 1_000_000) * 1.00,
      'sonar-pro': (tokens / 1_000_000) * 3.00,
    },
  };
  
  return pricing[provider]?.[model || ''] || 0;
}

async function handleLovableAI(config: AIProviderRequest): Promise<AIProviderResponse> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY || LOVABLE_API_KEY.trim() === '') {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  // Trim the API key to remove any whitespace or newlines
  const cleanApiKey = LOVABLE_API_KEY.trim();

  const model = config.model || 'google/gemini-2.5-flash';
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cleanApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: config.messages,
      tools: config.tools,
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens,
      stream: config.stream || false,
    }),
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '60';
    throw new Error(`RATE_LIMIT: Retry after ${retryAfter}s`);
  }
  
  if (response.status === 402) {
    throw new Error('PAYMENT_REQUIRED: Lovable AI credits exhausted');
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Lovable AI error: ${error}`);
  }

  const data = await response.json();
  
  // Log generation
  const trace = logGeneration(
    'lovable-ai-call',
    model,
    config.messages,
    data.choices[0].message.content,
    {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    }
  );

  const usage = {
    promptTokens: data.usage?.prompt_tokens || 0,
    completionTokens: data.usage?.completion_tokens || 0,
    totalTokens: data.usage?.total_tokens || 0,
    estimatedCost: calculateCost('lovable', data.usage?.total_tokens || 0, model),
  };

  return {
    content: data.choices[0].message.content,
    usage,
    model: data.model || model,
    provider: 'lovable',
    traceId: trace.id,
    traceUrl: `https://cloud.langfuse.com/trace/${trace.id}`,
  };
}

async function handleOpenAI(config: AIProviderRequest): Promise<AIProviderResponse> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY || OPENAI_API_KEY.trim() === '') {
    throw new Error('OPENAI_API_KEY not configured. Please add it in Supabase Edge Function Secrets.');
  }

  // Trim the API key to remove any whitespace or newlines
  const cleanApiKey = OPENAI_API_KEY.trim();

  const model = config.model || 'gpt-4o-mini';
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cleanApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: config.messages,
      tools: config.tools,
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens,
      stream: config.stream || false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${error}`);
  }

  const data = await response.json();

  // Log generation
  const trace = logGeneration(
    'openai-call',
    model,
    config.messages,
    data.choices[0].message.content,
    {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    }
  );

  const usage = {
    promptTokens: data.usage?.prompt_tokens || 0,
    completionTokens: data.usage?.completion_tokens || 0,
    totalTokens: data.usage?.total_tokens || 0,
    estimatedCost: calculateCost('openai', data.usage?.total_tokens || 0, model),
  };

  return {
    content: data.choices[0].message.content || '',
    usage,
    model: data.model,
    provider: 'openai',
    traceId: trace.id,
    traceUrl: `https://cloud.langfuse.com/trace/${trace.id}`,
  };
}

async function handlePerplexity(config: AIProviderRequest): Promise<AIProviderResponse> {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  
  if (!PERPLEXITY_API_KEY || PERPLEXITY_API_KEY.trim() === '') {
    throw new Error('PERPLEXITY_API_KEY not configured. Please add it in Supabase Edge Function Secrets.');
  }

  // Trim the API key to remove any whitespace or newlines
  const cleanApiKey = PERPLEXITY_API_KEY.trim();

  const model = config.model || 'sonar';
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cleanApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: config.messages,
      temperature: config.temperature || 0.2,
      max_tokens: config.max_tokens || 1000,
      stream: config.stream || false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity error: ${error}`);
  }

  const data = await response.json();

  // Log generation
  const trace = logGeneration(
    'perplexity-call',
    model,
    config.messages,
    data.choices[0].message.content,
    {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    }
  );

  const usage = {
    promptTokens: data.usage?.prompt_tokens || 0,
    completionTokens: data.usage?.completion_tokens || 0,
    totalTokens: data.usage?.total_tokens || 0,
    estimatedCost: calculateCost('perplexity', data.usage?.total_tokens || 0, model),
  };

  return {
    content: data.choices[0].message.content || '',
    usage,
    model: data.model,
    provider: 'perplexity',
    traceId: trace.id,
    traceUrl: `https://cloud.langfuse.com/trace/${trace.id}`,
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody: AIProviderRequest = await req.json();
    
    // Get default provider from environment
    const defaultProvider = Deno.env.get('AI_PROVIDER') || 'lovable';
    const provider = requestBody.provider || defaultProvider as 'lovable' | 'openai' | 'perplexity';

    let result: AIProviderResponse;

    if (provider === 'lovable') {
      result = await handleLovableAI(requestBody);
    } else if (provider === 'openai') {
      result = await handleOpenAI(requestBody);
    } else if (provider === 'perplexity') {
      result = await handlePerplexity(requestBody);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('AI Provider error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
