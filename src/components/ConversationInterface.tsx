import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import ConversationLog, { Message } from './ConversationLog';
import useElevenLabs from '@/hooks/useElevenLabs';
import { v4 as uuidv4 } from 'uuid';
import { toast } from '@/components/ui/use-toast';
import VoiceControls from './VoiceControls';
import { 
  requestMicrophoneAccess,
  isSpeechRecognitionSupported, 
  checkMicrophoneDevices 
} from '@/utils/microphonePermissions';

interface ConversationInterfaceProps {
  apiKey: string;
  agentId: string;
  onLogout?: () => void;
}

const ConversationInterface: React.FC<ConversationInterfaceProps> = ({ 
  apiKey, 
  agentId,
  onLogout 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState("");
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [autoStartMic, setAutoStartMic] = useState(true);
  const [isMicAvailable, setIsMicAvailable] = useState<boolean | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const hasRequestedMicPermission = useRef(false);
  const hasAttemptedSpeechRecognition = useRef(false);
  
  const { 
    generateSpeech, 
    isGenerating, 
    isPlaying, 
    error,
    stopAudio 
  } = useElevenLabs({
    apiKey,
    voiceId: agentId,
  });

  useEffect(() => {
    if (isGenerating || isPlaying) {
      if (recognitionRef.current) {
        console.log('Stopping microphone completely while audio is active');
        recognitionRef.current.stop();
        setIsListening(false);
      }
    } else if (autoStartMic && !isListening && !isGenerating && !isPlaying && !isMicMuted) {
      console.log('Auto-starting microphone after audio playback complete');
      const timer = setTimeout(() => {
        startListening();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isGenerating, isPlaying, isListening, autoStartMic, isMicMuted]);

  useEffect(() => {
    const checkMicrophoneAndInitialize = async () => {
      console.log('Checking microphone and initializing speech recognition...');
      
      setIsMicAvailable(true);
      
      try {
        const hasMicDevices = await checkMicrophoneDevices();
        console.log('Device has microphones:', hasMicDevices);
      } catch (err) {
        console.error('Error checking for microphone devices:', err);
      }
      
      try {
        const micAccess = await requestMicrophoneAccess();
        console.log('Microphone access granted:', micAccess);
      } catch (err) {
        console.error('Error requesting microphone access:', err);
      }
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';
          
          recognition.onstart = () => {
            console.log('Speech recognition started');
            setIsListening(true);
          };
          
          recognition.onend = () => {
            console.log('Speech recognition stopped');
            setIsListening(false);
            
            if (inputMode === 'voice' && autoStartMic && !isMicMuted && !hasAttemptedSpeechRecognition.current) {
              hasAttemptedSpeechRecognition.current = true;
              setTimeout(() => {
                if (!isPlaying && !isGenerating) {
                  console.log('Attempting to restart speech recognition');
                  try {
                    recognition.start();
                  } catch (e) {
                    console.error('Failed to restart speech recognition:', e);
                  }
                  setTimeout(() => {
                    hasAttemptedSpeechRecognition.current = false;
                  }, 5000);
                }
              }, 1000);
            }
          };
          
          recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const result = event.results[last];
            const text = result[0].transcript;
            setTranscript(text);
            
            if (result.isFinal) {
              processUserInput(text);
              setTranscript("");
              
              if (recognitionRef.current) {
                recognitionRef.current.stop();
              }
            }
          };
          
          recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
            
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
              toast({
                title: "Microphone Note",
                description: "Microphone access is needed for voice input. You can also use text input.",
                variant: "default"
              });
            } else {
              console.log(`Speech recognition error: ${event.error}`);
            }
          };
          
          recognitionRef.current = recognition;
        } catch (error) {
          console.error('Error setting up speech recognition:', error);
        }
      } else {
        console.log('SpeechRecognition not available in this browser');
        toast({
          title: "Browser Support Note",
          description: "Your browser may not fully support speech recognition. Text input is available.",
          variant: "default"
        });
      }
    };
    
    checkMicrophoneAndInitialize();
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [inputMode, autoStartMic, isMicMuted, isPlaying, isGenerating]);

  useEffect(() => {
    if (error) {
      setTtsError(error);
      
      if (!error.includes("quota")) {
        toast({
          title: "Speech Generation Note",
          description: error,
          variant: "default"
        });
      } else {
        console.log("TTS quota exceeded, continuing without voice output");
      }
      
      const errorMessage: Message = {
        id: uuidv4(),
        text: `I'm having trouble with my voice output. ${error.includes("quota") ? "The API quota has been exceeded." : "Please check if the Voice ID is correct."}`,
        sender: 'assistant',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [error]);

  useEffect(() => {
    const welcomeMessage: Message = {
      id: uuidv4(),
      text: "Hello! How can I help you today?",
      sender: 'assistant',
      timestamp: new Date(),
    };
    
    setMessages([welcomeMessage]);
    
    if (!isMuted) {
      try {
        generateSpeech(welcomeMessage.text);
      } catch (err) {
        console.error("Failed to generate speech for welcome message:", err);
      }
    }
  }, []);

  const requestMicrophonePermission = async () => {
    if (hasRequestedMicPermission.current) return true;
    
    try {
      hasRequestedMicPermission.current = true;
      await requestMicrophoneAccess();
      return true;
    } catch (err) {
      console.error('Microphone permission error:', err);
      return true;
    }
  };

  const processUserInput = (text: string) => {
    if (!text.trim()) return;
    
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    
    const userMessage: Message = {
      id: uuidv4(),
      text: text,
      sender: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    setTimeout(() => {
      const assistantResponse = "I understand you said: " + text + ". I'm here to help you with any questions or tasks.";
      const assistantMessage: Message = {
        id: uuidv4(),
        text: assistantResponse,
        sender: 'assistant',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (!isMuted && !ttsError) {
        if (recognitionRef.current && isListening) {
          recognitionRef.current.stop();
        }
        try {
          generateSpeech(assistantResponse);
        } catch (err) {
          console.error("Failed to generate speech:", err);
        }
      } else if (autoStartMic && !isPlaying && !isGenerating) {
        setTimeout(startListening, 300);
      }
    }, 1000);
  };

  const startListening = async () => {
    if (isPlaying || isGenerating || isMicMuted) {
      console.log('Cannot start listening: audio is active or mic is muted');
      return;
    }
    
    if (isListening) return;
    
    if (!recognitionRef.current) {
      console.log('Speech recognition not available, but allowing voice UI');
      return;
    }
    
    await requestMicrophonePermission();
    
    try {
      recognitionRef.current.start();
      console.log('Microphone activated');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  };

  const toggleListening = async () => {
    if (isMicMuted) {
      console.log('Microphone is muted, cannot toggle listening');
      return;
    }
    
    if (isPlaying || isGenerating) {
      stopAudio();
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } else {
      await startListening();
    }
  };

  const handleMicMuteToggle = () => {
    const newMuteState = !isMicMuted;
    setIsMicMuted(newMuteState);
    
    if (!newMuteState && autoStartMic && !isPlaying && !isGenerating) {
      setTimeout(startListening, 300);
    }
    
    if (newMuteState && isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      processUserInput(textInput);
      setTextInput("");
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (isPlaying) {
      stopAudio();
    }
  };

  const handleVolumeChange = (value: number) => {
    console.log('Setting audio volume to', value);
    setVolume(value);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 agent-card mb-6 overflow-hidden">
        <ConversationLog 
          messages={messages} 
          isGeneratingAudio={isGenerating} 
          isPlayingAudio={isPlaying}
          onToggleAudio={generateSpeech}
          onLogout={onLogout}
          className="h-full" 
        />
      </div>
      
      {transcript && !isMicMuted && isListening && (
        <div className="px-4 py-2 mb-4 bg-agent-secondary/10 rounded-lg text-gray-600 italic">
          Listening: {transcript}
        </div>
      )}
      
      {inputMode === 'voice' ? (
        <div className="flex justify-center py-4">
          <VoiceControls 
            isListening={isListening}
            isMuted={isMuted}
            volume={volume}
            onListen={toggleListening}
            onStopListening={toggleListening}
            onMuteToggle={handleMuteToggle}
            onVolumeChange={handleVolumeChange}
            onSwitchToText={() => setInputMode('text')}
            isMicMuted={isMicMuted}
            onMicMuteToggle={handleMicMuteToggle}
          />
        </div>
      ) : (
        <form onSubmit={handleTextSubmit} className="flex items-center space-x-2 p-4">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agent-primary"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-agent-primary text-white rounded-md hover:bg-agent-primary/90"
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => setInputMode('voice')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Use Voice
          </button>
        </form>
      )}
    </div>
  );
};

export default ConversationInterface;
