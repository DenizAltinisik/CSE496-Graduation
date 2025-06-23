import React, { useState } from 'react';
import axios from 'axios';

const MessageFeedback = ({ chatId, messageIndex, currentFeedback, onFeedbackUpdate }) => {
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (feedbackType) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const response = await axios.post(
        `/api/chat/${chatId}/message/${messageIndex}/feedback`,
        { feedback_type: feedbackType }
      );
      
      if (response.data.success) {
        onFeedbackUpdate(messageIndex, response.data.feedback);
        setShowMoreOptions(false);
      }
    } catch (error) {
      console.error('Error sending feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeFeedback = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const response = await axios.delete(
        `/api/chat/${chatId}/message/${messageIndex}/feedback`
      );
      
      if (response.data.success) {
        onFeedbackUpdate(messageIndex, null);
        setShowMoreOptions(false);
      }
    } catch (error) {
      console.error('Error removing feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFeedbackIcon = (feedbackType) => {
    const icons = {
      thumbs_up: '👍',
      thumbs_down: '👎',
      love: '❤️',
      funny: '😄',
      meaningless: '😐',
      offensive: '😠'
    };
    return icons[feedbackType] || '';
  };

  const getFeedbackLabel = (feedbackType) => {
    const labels = {
      thumbs_up: 'Like',
      thumbs_down: 'Dislike',
      love: 'Love',
      funny: 'Funny',
      meaningless: 'Meaningless',
      offensive: 'Offensive'
    };
    return labels[feedbackType] || '';
  };

  return (
    <div className="message-feedback-container">
      {/* Always visible feedback buttons */}
      <div className="feedback-buttons">
        <button
          className={`feedback-btn ${currentFeedback?.type === 'thumbs_up' ? 'active' : ''}`}
          onClick={() => handleFeedback('thumbs_up')}
          disabled={isSubmitting}
          title="Like"
        >
          👍
        </button>
        
        <button
          className={`feedback-btn ${currentFeedback?.type === 'thumbs_down' ? 'active' : ''}`}
          onClick={() => handleFeedback('thumbs_down')}
          disabled={isSubmitting}
          title="Dislike"
        >
          👎
        </button>
        
        <button
          className="feedback-btn more-options"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          disabled={isSubmitting}
          title="More options"
        >
          ⋯
        </button>
      </div>
      
      {/* More options dropdown */}
      {showMoreOptions && (
        <div className="more-options-dropdown">
          <div className="dropdown-header">
            What do you think about this reply?
          </div>
          
          <div className="dropdown-options">
            <button
              className={`option-btn ${currentFeedback?.type === 'love' ? 'active' : ''}`}
              onClick={() => handleFeedback('love')}
              disabled={isSubmitting}
            >
              ❤️ Love
            </button>
            
            <button
              className={`option-btn ${currentFeedback?.type === 'funny' ? 'active' : ''}`}
              onClick={() => handleFeedback('funny')}
              disabled={isSubmitting}
            >
              😄 Funny
            </button>
            
            <button
              className={`option-btn ${currentFeedback?.type === 'meaningless' ? 'active' : ''}`}
              onClick={() => handleFeedback('meaningless')}
              disabled={isSubmitting}
            >
              😐 Meaningless
            </button>
            
            <button
              className={`option-btn ${currentFeedback?.type === 'offensive' ? 'active' : ''}`}
              onClick={() => handleFeedback('offensive')}
              disabled={isSubmitting}
            >
              😠 Offensive
            </button>
          </div>
          
          {currentFeedback && (
            <div className="dropdown-actions">
              <button
                className="remove-feedback-btn"
                onClick={removeFeedback}
                disabled={isSubmitting}
              >
                🗑️ Remove feedback
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageFeedback;
