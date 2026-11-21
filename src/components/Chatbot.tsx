import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, X, Send, Bot, User, Minimize2, Maximize2, 
  Sparkles, Settings, HelpCircle, Mic, Volume2
} from 'lucide-react';
// ASSUMPTION: You have a centralized supabase client import
import { supabase } from '../lib/supabase'; 
// ASSUMPTION: You have a simple hook for user authentication state
import { useAuth } from '../hooks/useAuth'; 

// --- Type Definitions ---
interface Message {
  id: string;
  message: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  message_type?: string;
}

interface QuickReply {
  text: string;
  action: string;
}

// Extend Window interface for Speech Recognition API compatibility
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const Chatbot = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  const [lastAction, setLastAction] = useState<string | null>(null);
  
  // Voice State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null); 
  const synthRef = useRef<SpeechSynthesis | null>(null); 

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick replies for initial prompt
  const quickReplies: QuickReply[] = [
    { text: "What interior design services do you offer?", action: "services" },
    { text: "How do I find the right designer?", action: "find_designer" }
  ];
  
  // Follow-up suggestions based on the last user action/category
  const suggestedFollowUps: Record<string, QuickReply[]> = {
    services: [
      { text: "Do you offer 3D visualization?", action: "3d_visualization" },
      { text: "Can I get partial room design?", action: "partial_design" },
    ],
    find_designer: [
      { text: "How are designers verified?", action: "verification" },
      { text: "Can I see designer reviews?", action: "reviews" },
    ],
  };

  /**
   * Utility function to handle API calls with exponential backoff and retry logic.
   * Note: This function is kept general, but the 4xx error handling is less relevant
   * for a custom Supabase function than it was for the direct Gemini API.
   */
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries: number = 3): Promise<any> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // Success case (200-299)
        if (response.ok) {
          return response.json();
        }
        
        // Attempt to parse JSON response for error details
        const result = await response.json().catch(() => ({ error: "Could not parse response body" })); 

        // If it's a client error (4xx), stop and throw immediately (no retries)
        if (response.status >= 400 && response.status < 500) {
            console.error(`AI Function Error: Status ${response.status}. Full Response:`, result);
            throw new Error(`AI Function Client Error (${response.status}): ${result.error || 'Server rejected request.'}`);
        }
        
        // If it's a server error (5xx), log and retry
        if (response.status >= 500) {
             // Exponential backoff delay: 1s, 2s, 4s...
             await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        } else {
             // Handle other unexpected non-2xx status codes
             throw new Error(`API Unexpected Error (${response.status})`);
        }
        
      } catch (error) {
        // For network errors
        if (attempt === maxRetries - 1) {
             throw error;
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    throw new Error(`Failed to fetch from API after ${maxRetries} attempts.`);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Initialize chat and voice APIs
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      initializeChat();
    }
    
    // Initialize Speech Synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        synthRef.current = window.speechSynthesis;
    }
    
    // Cleanup function for voice APIs
    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        if (synthRef.current) {
            synthRef.current.cancel();
        }
    };
  }, [isOpen]);

  /**
   * Initializes a new chat conversation in the database.
   */
  const initializeChat = async () => {
    try {
      const { data: conversation, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user?.id || null,
          session_id: sessionId,
          title: 'Support Chat',
          status: 'active'
        })
        .select()
        .single();

      if (convError) throw convError;
      setConversationId(conversation.id);

      const welcomeMessage: Message = {
        id: 'welcome',
        message: "Hi. I can help you find a Pune designer, understand quotations, or choose a 3D wallpaper. What would you like to know?",
        sender: 'bot',
        timestamp: new Date(),
        message_type: 'welcome'
      };

      setMessages([welcomeMessage]);

      // Save welcome message to database
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          message: welcomeMessage.message,
          sender: 'bot',
          message_type: 'welcome'
        });
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  };
  
  /**
   * Queries the static knowledge base (Supabase) for specific, reliable answers.
   */
  const getKnowledgeBaseResponse = async (text: string, action: string | null): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('chatbot_knowledge')
        .select('category, question, answer, keywords, priority')
        .eq('is_active', true);

      if (error) throw error;
      const rows = data || [];
      if (action) {
        const byCategory = rows
          .filter((row) => row.category === action)
          .sort((left, right) => (right.priority || 0) - (left.priority || 0))[0];
        if (byCategory) return byCategory.answer;
      }

      const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !['the', 'and', 'you', 'your', 'for', 'with', 'can', 'how', 'what'].includes(word));
      const ranked = rows
        .map((row) => {
          const question = row.question.toLowerCase();
          const keywords = (row.keywords || []).map((keyword: string) => keyword.toLowerCase());
          const score = words.reduce((total, word) => {
            const inQuestion = question.includes(word) ? 3 : 0;
            const inKeywords = keywords.some((keyword) => keyword.includes(word) || word.includes(keyword)) ? 4 : 0;
            return total + inQuestion + inKeywords;
          }, 0);
          return { row, score };
        })
        .filter((item) => item.score >= 4)
        .sort((left, right) => right.score - left.score || (right.row.priority || 0) - (left.row.priority || 0));

      return ranked[0]?.row.answer || null;
    } catch (error) {
      console.error('Error fetching knowledge base response:', error);
      return null;
    }
  };
  
  /**
   * VOICE: Handles the bot reading the message aloud (Text-to-Speech)
   */
  const textToSpeech = (text: string) => {
    if (!synthRef.current || !isOpen || isListening) return;
    synthRef.current.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    synthRef.current.speak(utterance);
  };
  
  /**
   * VOICE: Handles starting/stopping voice input (Speech-to-Text)
   */
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("Speech recognition is not supported in your browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setInputMessage('Listening...');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setInputMessage('');
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSendMessage(transcript);
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setInputMessage('');
      };
    }
    
    recognitionRef.current.start();
  };

  /**
   * CORE: Main handler for sending messages.
   */
  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputMessage.trim();
    if (!textToSend || !conversationId) return;
    
    synthRef.current?.cancel();

    const allQuickReplies = [...quickReplies, ...Object.values(suggestedFollowUps).flat()];
    const matchingQuickReply = allQuickReplies.find(qr => qr.text === textToSend);
    const action = matchingQuickReply?.action || null;
    
    setLastAction(action || null);

    setIsLoading(true);
    setInputMessage('');

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      message: textToSend,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    
    try {
      // Save user message to database
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          message: textToSend,
          sender: 'user',
          message_type: 'text'
        });

      let botResponse: string;
      
      // 1. Try Knowledge Base first (for specific, reliable answers)
      let knowledgeResponse = await getKnowledgeBaseResponse(textToSend, action);
      
      if (knowledgeResponse) {
        botResponse = knowledgeResponse;
      } 
      // 2. Fallback to AI Service (Supabase Edge Function)
      else if (isAIEnabled) {
        try {
          // --- AI SERVICE CALL (Supabase Edge Function) ---
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-chat`;
          // Get the current session token for Supabase Authorization
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;

          // The Edge Function provided appears to handle context/history based on IDs.
          const payload = {
              message: textToSend , // Current message text
              conversationId: conversationId, // Send existing conversation ID
              sessionId: sessionId, // Send current session ID
          };
          
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          };

          // Add authorization header if a token exists
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          } else {
            // For anonymous users, use the anon key
            headers['Authorization'] = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
          }

          // Use the resilient fetchWithRetry function
          const result = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify( { prompt: payload })
          });

          // The Edge Function is expected to return the generated text under the 'response' key.
          const text = result?.response;
          
          if (text) {
            botResponse = text;
          } else if (result?.fallback) {
            // Handle fallback response when AI service is unavailable
            botResponse = result.response;
          } else {
            // Handle case where API is reachable but returns no text content
            console.error("AI function returned an empty or malformed text response.", result);
            throw new Error('AI service returned an empty response.');
          }
          // --- END AI SERVICE CALL ---

        } catch (aiError) {
          // Specific fallback for AI service failure (due to custom function error)
          console.error('AI service failure:', aiError); 
          botResponse = "I could not reach the assistant. Email supportcontact@thehomedesigners.in, or use the suggested questions for designers, quotations, and 3D wallpaper in Pune.";
        }
      } 
      // 3. Final Basic Fallback
      else {
        botResponse = "Email supportcontact@thehomedesigners.in and include your question. This chat can answer questions about Pune designers, quotations, and 3D wallpaper.";
      }

      // Add bot message
      const botMessage: Message = {
        id: `bot_${Date.now()}`,
        message: botResponse,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);

      // Save bot message to database
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          message: botResponse,
          sender: 'bot'
        });
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        message: "I'm sorry, I encountered a critical error. Please refresh or contact support.",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleQuickReply = (reply: QuickReply) => {
    handleSendMessage(reply.text);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const stopSpeech = () => {
      synthRef.current?.cancel();
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white p-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110"
          aria-label="Open chat support"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 transition-all duration-300 overflow-hidden ${
      isMinimized ? 'w-80 h-16' : 'w-80 h-96'
    }`}>
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-primary-500 to-secondary-600 text-white p-4 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center relative">
            <Bot className="w-5 h-5 absolute" style={{ opacity: isAIEnabled ? 1 : 0, transition: 'opacity 0.3s' }} />
            <User className="w-5 h-5 absolute" style={{ opacity: isAIEnabled ? 0 : 1, transition: 'opacity 0.3s' }} />
            {isAIEnabled && <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-yellow-300" />}
          </div>
          <div>
            <h3 className="font-semibold">{isAIEnabled ? 'AI Design Assistant' : 'Support Chat'}</h3>
            <p className="text-xs text-primary-100 flex items-center">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></span>
              Online
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAIEnabled(!isAIEnabled)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title={isAIEnabled ? "Switch to basic support" : "Enable AI assistant"}
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

    {!isMinimized && (
      <>
        {/* Chat body: messages + quick replies */}
        <div className="flex flex-col flex-grow h-[calc(24rem-112px)] overflow-hidden">
          {/* Scrollable messages */}
          <div 
            className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50"
            onClick={stopSpeech} 
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-2 max-w-[80%] ${
                  message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.sender === 'user' 
                      ? 'bg-primary-500 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {message.sender === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  </div>
                  <div className={`p-3 rounded-lg ${
                    message.sender === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    {/* VOICE: Button to replay the audio */}
                    {message.sender === 'bot' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); textToSpeech(message.message); }}
                            className="mt-2 text-primary-500 hover:text-primary-600 p-1 rounded-full bg-white/50"
                            title="Listen again"
                        >
                            <Volume2 className="w-3 h-3" />
                        </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                    <Bot className="w-3 h-3 text-gray-600" />
                  </div>
                  <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested replies */}
          {(messages.length <= 1 || (lastAction && suggestedFollowUps[lastAction])) && (
            <div className="px-4 py-2 bg-white border-t border-gray-200">
              <div className="flex flex-col space-y-2">
                {messages.length <= 1 && (
                  <>
                    <p className="text-xs text-gray-500 mb-1 flex items-center">
                      <HelpCircle className="w-3 h-3 mr-1" />
                      Suggested questions:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {quickReplies.map((reply, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuickReply(reply)}
                          className="text-xs bg-primary-50 text-primary-600 px-3 py-1 rounded-full hover:bg-primary-100 transition-colors flex items-center"
                        >
                          {reply.text}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {lastAction && suggestedFollowUps[lastAction] && (
                  <>
                    <p className="text-xs text-gray-500 mt-2 mb-1 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1" />
                      People also ask:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedFollowUps[lastAction].map((reply, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuickReply(reply)}
                          className="text-xs bg-accent-50 text-accent-700 px-3 py-1 rounded-full hover:bg-accent-100 transition-colors"
                        >
                          {reply.text}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input Field with Voice Option */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex space-x-2 items-center">
             {/* VOICE: Microphone Button */}
            <button
              onClick={toggleListening}
              className={`p-2 rounded-lg transition-colors shadow-sm flex-shrink-0 ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              title={isListening ? "Stop voice input" : "Start voice input"}
              disabled={isLoading}
            >
              <Mic className="w-4 h-4" />
            </button>
            
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? "Listening..." : (isAIEnabled ? "Ask me anything about design..." : "Type your message...")}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm"
              aria-label="Chat message"
              autoComplete="off"
              disabled={isLoading || isListening}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading || isListening}
              className="bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white p-2 rounded-lg transition-colors shadow-sm flex-shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </>
    )}
    </div>
  );
};

export default Chatbot;
