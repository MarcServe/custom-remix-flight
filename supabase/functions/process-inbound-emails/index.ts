import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Clean API key - removes any non-ASCII characters that cause ByteString errors
 */
function cleanApiKey(key: string | undefined): string | null {
  if (!key) return null;
  return key.trim().replace(/[^\x00-\x7F]/g, '');
}

const OPENAI_API_KEY = cleanApiKey(Deno.env.get('OPENAI_API_KEY'));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== INBOUND EMAIL WEBHOOK RECEIVED ===');
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Detect webhook source and parse accordingly
    const contentType = req.headers.get('content-type') || '';
    let from: string, to: string, subject: string, bodyHtml: string, bodyText: string;
    let messageId: string, threadId: string | null = null, inReplyTo: string | null = null;
    let webhookSource = 'unknown';
    
    console.log('Content-Type:', contentType);

    if (contentType.includes('application/json')) {
      // Resend webhook format
      webhookSource = 'resend';
      const payload = await req.json();
      console.log('Resend payload keys:', Object.keys(payload));
      
      // Extract from email with multiple fallback paths for nested Resend structure
      const rawFrom = 
        payload?.data?.from?.email ?? 
        payload?.data?.from ?? 
        payload?.from?.email ??
        payload?.from ??
        payload?.data?.envelope?.from ??
        payload?.envelope?.from;

      if (!rawFrom) {
        console.error('Inbound email missing from address', payload);
        return new Response(
          JSON.stringify({ error: 'Missing from address' }),
          { status: 400, headers: corsHeaders }
        );
      }

      from = rawFrom.trim().toLowerCase();
      
      // Extract other fields with similar fallback paths
      to = payload?.data?.to?.email ?? payload?.data?.to ?? payload?.to?.email ?? payload?.to ?? '';
      subject = payload?.data?.subject ?? payload?.subject ?? '';
      bodyHtml = payload?.data?.html_body ?? payload?.data?.bodyHtml ?? payload?.html ?? payload?.bodyHtml ?? '';
      bodyText = payload?.data?.text_body ?? payload?.data?.bodyText ?? payload?.text ?? payload?.bodyText ?? '';
      messageId = payload?.data?.message_id ?? payload?.messageId ?? payload?.message_id ?? `resend-${Date.now()}`;
      threadId = payload?.data?.thread_id ?? payload?.threadId ?? payload?.thread_id ?? null;
      inReplyTo = payload?.data?.in_reply_to ?? payload?.inReplyTo ?? payload?.in_reply_to ?? null;
      
      console.log('✅ Resend webhook parsed:', { from, to, subject, messageId, hasBody: !!bodyText });
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      // SendGrid Inbound Parse format
      webhookSource = 'sendgrid';
      const formData = await req.formData();
      
      console.log('SendGrid form data keys:', Array.from(formData.keys()));
      
      from = formData.get('from') as string || '';
      to = formData.get('to') as string || '';
      subject = formData.get('subject') as string || '';
      bodyHtml = formData.get('html') as string || '';
      bodyText = formData.get('text') as string || '';
      
      // Extract email from "Name <email@domain.com>" format
      const emailMatch = from.match(/<([^>]+)>/);
      if (emailMatch) {
        from = emailMatch[1];
      }
      
      // Parse headers to extract Message-ID and In-Reply-To
      const headersStr = formData.get('headers') as string || '';
      const headerLines = headersStr.split('\n');
      
      messageId = ''; // Initialize
      
      for (const line of headerLines) {
        if (line.toLowerCase().startsWith('message-id:')) {
          messageId = line.substring(11).trim().replace(/[<>]/g, '');
        } else if (line.toLowerCase().startsWith('in-reply-to:')) {
          inReplyTo = line.substring(12).trim().replace(/[<>]/g, '');
        } else if (line.toLowerCase().startsWith('references:')) {
          // Extract thread ID from References header (first message-id in the chain)
          const refs = line.substring(11).trim().split(/\s+/);
          if (refs.length > 0) {
            threadId = refs[0].replace(/[<>]/g, '');
          }
        }
      }
      
      // Fallback: Generate unique ID if message-id not found
      if (!messageId) {
        messageId = `sendgrid-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      }
      
      // Fallback: use message-id as threadId if not found
      if (!threadId && messageId) {
        threadId = messageId;
      }
      
      console.log('✅ SendGrid webhook parsed:', { 
        from, 
        to, 
        subject, 
        messageId, 
        inReplyTo, 
        threadId,
        hasBody: !!bodyText 
      });
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    console.log(`Webhook source: ${webhookSource}`);
    
    // VALIDATION: Prevent self-emails from triggering auto-responses
    // Check if the sender is the same as any of our system emails
    const { data: userEmails } = await supabaseClient
      .from('profiles')
      .select('email');
    
    const systemEmails = userEmails?.map(p => p.email?.toLowerCase()) || [];
    const fromEmailLower = from.toLowerCase();
    
    if (systemEmails.includes(fromEmailLower)) {
      console.log(`⚠️ SKIPPING: Self-sent email detected from ${from}. Not processing as inbound.`);
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Self-sent email ignored',
          reason: 'Sender is a system user'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Helper function to calculate subject similarity (Levenshtein-based)
    const calculateSubjectSimilarity = (subject1: string, subject2: string): number => {
      const s1 = subject1.toLowerCase().replace(/^(re:|fwd:)\s*/gi, '').trim();
      const s2 = subject2.toLowerCase().replace(/^(re:|fwd:)\s*/gi, '').trim();
      
      // Simple similarity: check if subjects share common words
      const words1 = s1.split(/\s+/);
      const words2 = s2.split(/\s+/);
      const commonWords = words1.filter(w => words2.includes(w) && w.length > 3);
      
      return commonWords.length / Math.max(words1.length, words2.length);
    };

    // Find the company sequence by matching sender email, thread ID, In-Reply-To, or subject similarity
    // Step 1: Try matching via In-Reply-To or thread_id (most reliable)
    let matchedSequence = null;
    let matchedActivity = null;
    let matchMethod = '';

    if (inReplyTo || threadId) {
      console.log('🔍 Step 1: Attempting to match by In-Reply-To or thread_id:', { inReplyTo, threadId });
      
      const { data: activities } = await supabaseClient
        .from('email_activities')
        .select('*, company_sequences(*)')
        .or(`external_message_id.eq.${inReplyTo},thread_id.eq.${threadId}`)
        .limit(1);

      if (activities && activities.length > 0) {
        console.log('✅ Matched email via In-Reply-To/thread_id');
        matchedActivity = activities[0];
        matchedSequence = matchedActivity.company_sequences;
        matchMethod = 'thread_id';
      }
    }

    // Step 2: Fallback - Match by sender email
    if (!matchedSequence) {
      console.log('🔍 Step 2: Fallback - matching by sender email from:', from);
      
      const { data: sequences, error: seqError } = await supabaseClient
        .from('company_sequences')
        .select(`
          *,
          email_sequences(goal, ai_instructions, created_by),
          companies(name, industry, description),
          email_activities(id, external_message_id, thread_id, subject, metadata)
        `)
        .eq('status', 'active')
        .not('next_action', 'eq', 'completed');

      if (seqError) throw seqError;

      // Match by checking email_activities metadata for matching to_email
      for (const seq of sequences || []) {
        const activities = seq.email_activities || [];
        const matching = activities.find((act: any) => 
          act.metadata?.to_email === from || 
          act.metadata?.recipient_email === from
        );
        
        if (matching) {
          matchedSequence = seq;
          matchedActivity = matching;
          matchMethod = 'sender_email';
          console.log('✅ Matched via email address in activities');
          break;
        }
      }
    }

    // Step 3: Final fallback - Match by subject line similarity (for threading issues)
    if (!matchedSequence) {
      console.log('🔍 Step 3: Final fallback - matching by subject similarity for:', subject);
      
      const { data: recentActivities } = await supabaseClient
        .from('email_activities')
        .select(`
          *,
          company_sequences(
            *,
            email_sequences(goal, ai_instructions, created_by),
            companies(name, industry, description)
          )
        `)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(20); // Check last 20 sent emails

      if (recentActivities && recentActivities.length > 0) {
        let bestMatch = null;
        let bestSimilarity = 0;

        for (const activity of recentActivities) {
          if (activity.subject && activity.company_sequences) {
            const similarity = calculateSubjectSimilarity(subject, activity.subject);
            
            // Also check if sender email matches recipient in metadata
            const recipientMatches = 
              activity.metadata?.to_email === from || 
              activity.metadata?.recipient_email === from;
            
            // Boost similarity if recipient also matches
            const finalSimilarity = recipientMatches ? similarity + 0.3 : similarity;
            
            if (finalSimilarity > bestSimilarity && finalSimilarity > 0.4) {
              bestSimilarity = finalSimilarity;
              bestMatch = activity;
            }
          }
        }

        if (bestMatch) {
          matchedActivity = bestMatch;
          matchedSequence = bestMatch.company_sequences;
          matchMethod = 'subject_similarity';
          console.log(`✅ Matched via subject similarity (${Math.round(bestSimilarity * 100)}%)`);
        }
      }
    }

    if (!matchedSequence) {
      console.log('⚠️ No matching sequence found for email from:', from);
      console.log('This is normal for first-time contacts or emails not part of an active sequence');
      
      // Still store the email for visibility, without a sequence
      await supabaseClient
        .from('email_threads')
        .insert({
          company_sequence_id: null,
          message_id: messageId,
          thread_id: threadId,
          direction: 'inbound',
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          from_email: from,
          to_email: to,
          metadata: {
            webhook_source: webhookSource,
            unmatched: true,
          },
        });
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Email received but no active sequence found',
          stored: true 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Matched sequence: ${matchedSequence.id} (${matchedSequence.companies?.name}) via ${matchMethod}`);

    // Analyze email with AI
    let sentiment = 'neutral';
    let aiAnalysis = {};

    if (OPENAI_API_KEY) {
      try {
        const analysisPrompt = `Analyze this email response and provide:
1. Sentiment: positive, negative, neutral, interested, not_interested, or requesting_info
2. Key points mentioned
3. Questions asked
4. Intent (what does the sender want?)

Email:
From: ${from}
Subject: ${subject}
Body: ${bodyText}

Return a JSON object with: sentiment, keyPoints (array), questionsAsked (array), intent (string)`;

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: 'You are an email analysis expert. Analyze emails and extract structured insights.' 
              },
              { role: 'user', content: analysisPrompt }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'analyze_email',
                description: 'Analyze email and return structured insights',
                parameters: {
                  type: 'object',
                  properties: {
                    sentiment: { 
                      type: 'string', 
                      enum: ['positive', 'negative', 'neutral', 'interested', 'not_interested', 'requesting_info'] 
                    },
                    keyPoints: { type: 'array', items: { type: 'string' } },
                    questionsAsked: { type: 'array', items: { type: 'string' } },
                    intent: { type: 'string' }
                  },
                  required: ['sentiment', 'keyPoints', 'questionsAsked', 'intent']
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'analyze_email' } }
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            aiAnalysis = JSON.parse(toolCall.function.arguments);
            sentiment = (aiAnalysis as any).sentiment || 'neutral';
            console.log('AI Analysis:', aiAnalysis);
          }
        }
      } catch (error) {
        console.error('AI analysis error:', error);
      }
    }

    // Store the inbound email in email_threads
    // Use matched thread_id if available for proper threading
    const useThreadId = matchedActivity?.thread_id || threadId;
    
    // Validate required fields before insert
    if (!from || !to) {
      console.error('Missing required email fields:', { from, to });
      throw new Error(`Missing required email fields. from: ${from}, to: ${to}`);
    }

    const { data: thread, error: threadError } = await supabaseClient
      .from('email_threads')
      .insert({
        company_sequence_id: matchedSequence.id,
        message_id: messageId || `fallback-${Date.now()}`,
        thread_id: useThreadId,
        direction: 'inbound',
        subject: subject || '(no subject)',
        body_html: bodyHtml,
        body_text: bodyText,
        from_email: from,  // Now guaranteed to be non-null
        to_email: to,      // Now guaranteed to be non-null
        sentiment,
        ai_analysis: aiAnalysis,
      })
      .select()
      .single();

    if (threadError) throw threadError;

    // Update email_activities with replied_at timestamp if we matched an activity
    if (matchedActivity) {
      console.log('✅ Updating email activity with reply timestamp');
      await supabaseClient
        .from('email_activities')
        .update({ 
          replied_at: new Date().toISOString(),
          status: 'replied',
          metadata: {
            ...matchedActivity.metadata,
            reply_detected: true,
            reply_method: matchMethod,
          }
        })
        .eq('id', matchedActivity.id);
    } else {
      console.log('⚠️ No specific activity matched, updating sequence only');
    }

    // Update conversation history
    const conversationHistory = matchedSequence.conversation_history || [];
    conversationHistory.push({
      direction: 'inbound',
      from,
      subject,
      body: bodyText,
      timestamp: new Date().toISOString(),
      sentiment,
    });

    // Determine next action based on sentiment and AI analysis
    let nextAction = 'wait_for_response';
    if (sentiment === 'interested' || sentiment === 'requesting_info') {
      nextAction = 'personalized_response';
    } else if (sentiment === 'not_interested') {
      nextAction = 'paused';
    }

    // Update company sequence
    await supabaseClient
      .from('company_sequences')
      .update({
        conversation_history: conversationHistory,
        ai_context: {
          ...matchedSequence.ai_context,
          last_response_sentiment: sentiment,
          last_response_at: new Date().toISOString(),
          ai_analysis: aiAnalysis,
        },
        next_action: nextAction,
      })
      .eq('id', matchedSequence.id);

    // If AI response is needed, trigger generation
    if (nextAction === 'personalized_response') {
      console.log('Triggering AI response generation');
      
      // Check if auto-response is enabled for this sequence
      const autoSend = matchedSequence.auto_respond_enabled === true;
      console.log(`Auto-response enabled (sequence): ${autoSend}`);
      
      // Call generate-ai-response function with autoSend flag
      const { error: generateError } = await supabaseClient.functions.invoke('generate-ai-response', {
        body: { 
          companySequenceId: matchedSequence.id,
          inboundThreadId: thread.id,
          autoSend 
        },
      });

      if (generateError) {
        console.error('Error triggering AI response:', generateError);
      } else {
        console.log(`AI response generation triggered (autoSend: ${autoSend})`);
      }
    }
    
    // Also check for standalone email auto-responder (not sequence-based)
    // This handles emails sent from People page with auto-responder toggle enabled
    if (matchedActivity && !matchedSequence.auto_respond_enabled) {
      const enableAutoResponder = matchedActivity.metadata?.enable_auto_responder === true;
      console.log(`Standalone email auto-responder enabled: ${enableAutoResponder}`);
      
      if (enableAutoResponder && (sentiment === 'interested' || sentiment === 'requesting_info' || sentiment === 'positive')) {
        console.log('Triggering standalone AI auto-response');
        
        const { error: generateError } = await supabaseClient.functions.invoke('generate-ai-response', {
          body: { 
            companySequenceId: matchedSequence.id,
            inboundThreadId: thread.id,
            autoSend: true // Auto-send if enabled from People page
          },
        });

        if (generateError) {
          console.error('Error triggering standalone AI response:', generateError);
        } else {
          console.log('Standalone AI auto-response triggered');
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email processed',
        sequenceId: matchedSequence.id,
        threadId: thread.id,
        sentiment,
        nextAction,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error processing inbound email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});