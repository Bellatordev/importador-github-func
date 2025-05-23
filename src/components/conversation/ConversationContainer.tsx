
import React from 'react';
import ConversationLog from '../ConversationLog';
import ConversationControls from './ConversationControls';

interface ConversationContainerProps {
  messages: any[];
  isGenerating: boolean;
  isPlaying: boolean;
  onToggleAudio: (messageId: string, text: string, audioElement?: HTMLAudioElement | null) => void;
  onRestartConversation: () => void;
  onEndConversation: () => void;
  onPlaybackEnd?: () => void;
  onLogout?: () => void;
}

const ConversationContainer: React.FC<ConversationContainerProps> = ({
  messages,
  isGenerating,
  isPlaying,
  onToggleAudio,
  onRestartConversation,
  onEndConversation,
  onPlaybackEnd,
  onLogout
}) => {
  return (
    <div className="flex-1 agent-card mb-6 overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <ConversationControls 
        onRestartConversation={onRestartConversation}
        onEndConversation={onEndConversation}
      />
      <ConversationLog 
        messages={messages} 
        isGeneratingAudio={isGenerating} 
        isPlayingAudio={isPlaying}
        onToggleAudio={(messageId, text, audioElement) => onToggleAudio(messageId, text, audioElement)}
        onPlaybackEnd={onPlaybackEnd}
        className="h-full" 
        onLogout={onLogout}
      />
    </div>
  );
};

export default ConversationContainer;
