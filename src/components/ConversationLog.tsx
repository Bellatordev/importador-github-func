
import React, { useRef, useEffect } from 'react';
import { DownloadIcon, CopyIcon } from 'lucide-react';

export type Message = {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
};

type ConversationLogProps = {
  messages: Message[];
  className?: string;
};

const ConversationLog: React.FC<ConversationLogProps> = ({ messages, className }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const copyConversation = () => {
    const text = messages
      .map(msg => `${msg.sender === 'user' ? 'You' : 'Assistant'}: ${msg.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
  };

  const downloadConversation = () => {
    const text = messages
      .map(msg => `${formatTimestamp(msg.timestamp)} - ${msg.sender === 'user' ? 'You' : 'Assistant'}: ${msg.text}`)
      .join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Conversation</h2>
        
        <div className="flex space-x-2">
          <button 
            onClick={copyConversation}
            className="p-2 text-gray-500 hover:text-agent-primary rounded-full hover:bg-gray-100 transition-colors focus-ring"
            aria-label="Copy conversation"
          >
            <CopyIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={downloadConversation}
            className="p-2 text-gray-500 hover:text-agent-primary rounded-full hover:bg-gray-100 transition-colors focus-ring"
            aria-label="Download conversation"
          >
            <DownloadIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-4 p-1">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.sender === 'user'
                    ? 'bg-agent-user text-gray-800 rounded-tr-none'
                    : 'bg-agent-assistant text-gray-800 rounded-tl-none'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-sm">{message.text}</span>
                  <span className="text-xs text-gray-500 mt-1 self-end">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ConversationLog;
