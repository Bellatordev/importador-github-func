
import React, { useEffect, useRef } from 'react';
import useConversation from '@/hooks/useConversation';
import { toast } from '@/components/ui/use-toast';
import ElevenLabsService from '@/services/elevenLabsService';

interface ConversationHandlerProps {
  generateSpeech?: (text: string) => Promise<void>;
  isMuted: boolean;
  autoStartMic: boolean;
  isPlaying: boolean;
  isGenerating: boolean;
  startListening?: () => Promise<void>;
  ttsError: string | null;
  webhookUrl?: string;
  agentName?: string;
  children: (props: {
    messages: any[];
    setMessages: React.Dispatch<React.SetStateAction<any[]>>;
    processUserInput: (text: string) => void;
    isProcessing: boolean;
    initializeConversation: () => void;
    restartConversation: () => void;
  }) => React.ReactNode;
}

const ConversationHandler: React.FC<ConversationHandlerProps> = ({
  generateSpeech,
  isMuted,
  autoStartMic,
  isPlaying,
  isGenerating,
  startListening,
  ttsError,
  webhookUrl,
  agentName,
  children,
}) => {
  const previousWebhookUrlRef = useRef<string | undefined>(webhookUrl);
  const previousAgentNameRef = useRef<string | undefined>(agentName);
  const restartingRef = useRef(false);
  
  const {
    messages,
    setMessages,
    processUserInput,
    initializeConversation,
    restartConversation,
    isProcessing
  } = useConversation({
    generateSpeech,
    isMuted,
    autoStartMic,
    isPlaying,
    isGenerating,
    startListening,
    ttsError,
    webhookUrl,
    agentName
  });

  // Cleanup function to ensure all resources are properly released
  const cleanupResources = () => {
    try {
      console.log("Cleaning up audio resources in ConversationHandler");
      const elevenLabsInstance = ElevenLabsService.getInstance();
      elevenLabsInstance.stopAudio();
    } catch (err) {
      console.error('Error during ConversationHandler cleanup:', err);
    }
  };

  // Initialize the conversation when the component mounts
  useEffect(() => {
    // Clean up the storage to force initialization on page refresh
    if (window.location.pathname.includes('/conversation')) {
      sessionStorage.removeItem('conversation_initialized');
    }
    
    // Always initialize when this component mounts
    console.log("ConversationHandler mounted, initializing conversation");
    
    // Small delay to ensure all services are properly initialized before
    // triggering the welcome message with speech
    const timer = setTimeout(() => {
      initializeConversation();
    }, 300);
    
    return () => {
      clearTimeout(timer);
      cleanupResources();
    };
  }, [initializeConversation]);

  // Restart the conversation when the webhook URL or agent name changes
  useEffect(() => {
    if (previousWebhookUrlRef.current !== webhookUrl || 
        previousAgentNameRef.current !== agentName) {
      // Only restart if this isn't the initial load
      if (previousWebhookUrlRef.current !== undefined) {
        console.log("Agent configuration changed, restarting conversation:");
        console.log("Previous webhook:", previousWebhookUrlRef.current);
        console.log("New webhook:", webhookUrl);
        console.log("Previous agent:", previousAgentNameRef.current);
        console.log("New agent:", agentName);
        
        // Prevent duplicate restarts
        if (!restartingRef.current) {
          restartingRef.current = true;
          
          // Clean up existing resources first
          cleanupResources();
          
          // Restart the conversation with the new agent configuration
          setTimeout(() => {
            restartConversation();
            restartingRef.current = false;
          }, 500);
        }
      }
      
      // Update refs
      previousWebhookUrlRef.current = webhookUrl;
      previousAgentNameRef.current = agentName;
    }
  }, [webhookUrl, agentName, restartConversation]);

  return <>{children({ messages, setMessages, processUserInput, isProcessing, initializeConversation, restartConversation })}</>;
};

export default ConversationHandler;
