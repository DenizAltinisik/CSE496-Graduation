import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MessageFeedback from './MessageFeedback';
import './Chat.css';

// YouTube Video Component
const YouTubeEmbed = ({ videoId }) => {
  return (
    <div className="youtube-embed">
      <iframe
        width="100%"
        height="315"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&fs=1&cc_load_policy=0&iv_load_policy=3&autohide=0`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
      ></iframe>
    </div>
  );
};

// Function to parse YouTube video tags from message content
const parseMessageContent = (content) => {
  const youtubeRegex = /\[YOUTUBE_VIDEO\](.*?)\[\/YOUTUBE_VIDEO\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = youtubeRegex.exec(content)) !== null) {
    // Add text before the video
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex, match.index)
      });
    }
    
    // Add video
    parts.push({
      type: 'youtube',
      videoId: match[1]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex)
    });
  }
  
  return parts.length > 0 ? parts : [{ type: 'text', content }];
};

// Function to format message text (bold, italic, etc.)
const formatMessage = (text) => {
  return text.split('\n').map((line, lineIndex) => (
    <div key={lineIndex}>
      {line.includes('**') ? (
        <strong>{line.replace(/\*\*/g, '')}</strong>
      ) : line.includes('*') ? (
        <em>{line.replace(/\*/g, '')}</em>
      ) : (
        line
      )}
    </div>
  ));
};

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    loadChatHistory();
  }, []);

  // Auto-scroll when new messages are added
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const loadChatHistory = async () => {
    try {
      const response = await axios.get('/api/chat/history');
      setChatHistory(response.data.chats || []);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const loadChat = async (chatId) => {
    try {
      const response = await axios.get(`/api/chat/${chatId}`);
      const chat = response.data.chat;
      setMessages(chat.messages || []);
      setCurrentChatId(chatId);
      setSelectedChat(chat);
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setSelectedChat(null);
    setInputMessage('');
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setInputMessage('');

    try {
      const response = await axios.post('/api/chat', {
        message: inputMessage,
        chat_id: currentChatId
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      if (!currentChatId) {
        setCurrentChatId(response.data.chat_id);
        loadChatHistory(); // Refresh chat history
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, an error occurred. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFeedbackUpdate = (messageIndex, feedback) => {
    setMessages(prev => prev.map((msg, index) => 
      index === messageIndex 
        ? { ...msg, user_feedback: feedback }
        : msg
    ));
  };

  const updateMessageFeedback = (messageIndex, feedback) => {
    setMessages(messages.map((msg, index) => 
      index === messageIndex 
        ? { ...msg, user_feedback: feedback }
        : msg
    ));
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="chat-header">
          <button className="new-chat-btn" onClick={startNewChat}>
            + New Chat
          </button>
        </div>
        
        <div className="chat-history">
          <h4>Chat History</h4>
          {chatHistory.length === 0 ? (
            <p className="no-chats">No conversations yet</p>
          ) : (
            chatHistory.map((chat) => (
              <div
                key={chat._id}
                className={`chat-history-item ${selectedChat?._id === chat._id ? 'active' : ''}`}
                onClick={() => loadChat(chat._id)}
              >
                <div className="chat-title">{chat.title}</div>
                <div className="chat-date">
                  {new Date(chat.updated_at).toLocaleDateString('en-US')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chat-main">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="welcome-message">
              <p>
                Hello! I'm your AI assistant using a multi-level problem-solving approach.
                I analyze your questions, develop strategies, and provide detailed implementation plans.
              </p>
              <div className="features">
                <div className="feature">
                  <div className="feature-icon">🔍</div>
                  <div>Analysis</div>
                </div>
                <div className="feature">
                  <div className="feature-icon">📋</div>
                  <div>Strategy</div>
                </div>
                <div className="feature">
                  <div className="feature-icon">⚡</div>
                  <div>Implementation</div>
                </div>
              </div>
              <p>Ask a question and let's get started!</p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  <div className="message-content">
                    {parseMessageContent(message.content).map((part, partIndex) => (
                      part.type === 'text' ? (
                        <div key={partIndex} className="message-text">
                          {formatMessage(part.content)}
                        </div>
                      ) : (
                        <YouTubeEmbed key={partIndex} videoId={part.videoId} />
                      )
                    ))}
                    <div className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    {message.role === 'assistant' && currentChatId && (
                      <MessageFeedback 
                        chatId={currentChatId}
                        messageIndex={index} 
                        currentFeedback={message.user_feedback}
                        onFeedbackUpdate={handleFeedbackUpdate} 
                      />
                    )}
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="message assistant">
                  <div className="message-content">
                    <div className="typing-indicator">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span className="typing-text">Assistant is typing...</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-container">
          <div className="chat-input">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe your problem in detail..."
              disabled={loading}
              rows={3}
            />
            <button 
              onClick={sendMessage} 
              disabled={!inputMessage.trim() || loading}
              className="send-button"
            >
              {loading ? '⏳' : '📤'}
            </button>
          </div>
          <div className="input-hint">
            Press Enter to send • Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
