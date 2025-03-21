
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';

interface UseSpeechRecognitionProps {
  isListening: boolean;
  isMicMuted: boolean;
  onTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
}

export const useSpeechRecognition = ({
  isListening,
  isMicMuted,
  onTranscript,
  onFinalTranscript
}: UseSpeechRecognitionProps) => {
  const [transcript, setTranscript] = useState('');
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(true);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  // Check for microphone permissions
  useEffect(() => {
    const checkMicrophonePermission = async () => {
      try {
        // First check if permissions API is supported
        if (navigator.permissions) {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setPermissionState(permissionStatus.state);
          
          permissionStatus.onchange = () => {
            setPermissionState(permissionStatus.state);
            
            if (permissionStatus.state === 'granted') {
              console.log('Microphone permission granted');
              // Reinitialize recognition if permission was just granted
              initializeRecognition();
            } else if (permissionStatus.state === 'denied') {
              console.log('Microphone permission denied');
              toast({
                title: "Microphone Access Denied",
                description: "Please enable microphone access in your browser settings to use voice features.",
                variant: "destructive",
              });
            }
          };
        } else {
          // Fallback for browsers that don't support permissions API
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Clean up
            console.log('Microphone access granted via getUserMedia');
          } catch (error) {
            console.error('Microphone access denied via getUserMedia:', error);
            toast({
              title: "Microphone Access Required",
              description: "Please enable microphone access to use voice features.",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Error checking microphone permission:', error);
      }
    };
    
    checkMicrophonePermission();
  }, []);

  // Initialize speech recognition
  const initializeRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser');
      setIsRecognitionSupported(false);
      toast({
        title: "Speech Recognition Unavailable",
        description: "Your browser doesn't support speech recognition. Try using Chrome, Edge, or Safari.",
        variant: "destructive",
      });
      return;
    }

    try {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event) => {
        let currentTranscript = '';
        let isFinal = false;
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
          isFinal = event.results[i].isFinal;
        }
        
        setTranscript(currentTranscript);
        
        // Always call onTranscript with the current transcript for real-time display
        onTranscript?.(currentTranscript);
        
        if (isFinal) {
          console.log('Final transcript:', currentTranscript);
          onFinalTranscript?.(currentTranscript);
          setTranscript('');
        }
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error', event);
        if (event.error === 'not-allowed') {
          console.error('Microphone access denied');
          toast({
            title: "Microphone Access Denied",
            description: "Please enable microphone access in your browser settings.",
            variant: "destructive",
          });
          setPermissionState('denied');
        } else if (event.error === 'audio-capture') {
          console.error('No microphone found');
          toast({
            title: "No Microphone Found",
            description: "Please connect a microphone to use voice features.",
            variant: "destructive",
          });
        }
      };
      
      setRecognition(recognitionInstance);
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      setIsRecognitionSupported(false);
    }
  }, [onTranscript, onFinalTranscript]);

  // Initialize recognition on mount
  useEffect(() => {
    initializeRecognition();
  }, [initializeRecognition]);

  // Request microphone access explicitly when user attempts to listen
  useEffect(() => {
    if (isListening && !isMicMuted && permissionState !== 'granted') {
      const requestMicrophoneAccess = async () => {
        try {
          console.log('Requesting microphone access...');
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop()); // Clean up
          console.log('Microphone access granted');
          setPermissionState('granted');
        } catch (error) {
          console.error('Error requesting microphone access:', error);
          toast({
            title: "Microphone Access Required",
            description: "Please allow microphone access when prompted by your browser.",
            variant: "destructive",
          });
          setPermissionState('denied');
        }
      };
      
      requestMicrophoneAccess();
    }
  }, [isListening, isMicMuted, permissionState]);

  // Start/stop recognition based on listening state and mic mute state
  useEffect(() => {
    if (!recognition) return;
    
    const shouldBeListening = isListening && !isMicMuted && permissionState !== 'denied';
    
    if (shouldBeListening) {
      try {
        recognition.start();
        console.log('Speech recognition started');
      } catch (error) {
        // If it's already running, restart it
        try {
          recognition.stop();
          setTimeout(() => {
            if (isListening && !isMicMuted) { // Double-check state before restarting
              recognition.start();
              console.log('Speech recognition restarted');
            }
          }, 100);
        } catch (innerError) {
          console.error('Error restarting speech recognition:', innerError);
        }
      }
    } else {
      try {
        recognition.stop();
        console.log('Speech recognition stopped');
        
        // Clear transcript when stopping
        setTranscript('');
        onTranscript?.('');
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
    
    return () => {
      try {
        recognition.stop();
      } catch (error) {
        // Ignore errors when stopping during cleanup
      }
    };
  }, [isListening, isMicMuted, recognition, onTranscript, permissionState]);

  return { 
    transcript, 
    isRecognitionSupported,
    permissionState 
  };
};

export default useSpeechRecognition;
