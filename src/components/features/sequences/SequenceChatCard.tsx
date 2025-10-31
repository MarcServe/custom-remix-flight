import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, MessageSquare, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ExtractedParams {
  industry?: string;
  geography?: string;
  size?: string;
  tone?: string;
  steps?: number;
}

export const SequenceChatCard = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [extractedParams, setExtractedParams] = useState<ExtractedParams>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const examplePrompts = [
    "Create a 4-step sequence for B2B SaaS companies in the UK",
    "Generate emails for enterprise fintech in North America",
    "Build a casual sequence for small tech startups"
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/sequence-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            extractedParams
          })
        }
      );

      if (!response.ok || !response.body) {
        throw new Error('Failed to start stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let textBuffer = '';

      // Add empty assistant message that we'll update
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            
            // Handle parameter extraction
            if (parsed.params) {
              setExtractedParams(prev => ({ ...prev, ...parsed.params }));
            }
            
            // Handle content delta
            if (parsed.content) {
              assistantMessage += parsed.content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: 'assistant',
                  content: assistantMessage
                };
                return newMessages;
              });
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    textareaRef.current?.focus();
  };

  return (
    <Card className="h-full flex flex-col border-2 hover:border-primary/50 transition-all shadow-lg bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              AI Sequence Builder
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            </CardTitle>
            <CardDescription className="text-xs">
              Describe your sequence in natural language
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Extracted Parameters */}
        {Object.keys(extractedParams).length > 0 && (
          <div className="p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Extracted Parameters</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {extractedParams.industry && (
                <Badge variant="secondary" className="text-xs">
                  Industry: {extractedParams.industry}
                </Badge>
              )}
              {extractedParams.geography && (
                <Badge variant="secondary" className="text-xs">
                  Geography: {extractedParams.geography}
                </Badge>
              )}
              {extractedParams.size && (
                <Badge variant="secondary" className="text-xs">
                  Size: {extractedParams.size}
                </Badge>
              )}
              {extractedParams.tone && (
                <Badge variant="secondary" className="text-xs">
                  Tone: {extractedParams.tone}
                </Badge>
              )}
              {extractedParams.steps && (
                <Badge variant="secondary" className="text-xs">
                  Steps: {extractedParams.steps}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="space-y-6 py-8">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">Start a Conversation</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Tell me what kind of email sequence you want to create
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground px-2">Try these examples:</p>
                {examplePrompts.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(example)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-xs"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isStreaming && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">AI is thinking...</span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-card">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your sequence... (e.g., 'Create 4 emails for enterprise SaaS in Europe')"
              className="flex-1 min-h-[60px] max-h-[120px] resize-none text-sm"
              disabled={isStreaming}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              {isStreaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
