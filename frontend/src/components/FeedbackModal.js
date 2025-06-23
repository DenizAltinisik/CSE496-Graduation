import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FeedbackModal.css';

const FeedbackModal = ({ isOpen, onClose }) => {
    const [feedback, setFeedback] = useState({
        design: 0,
        usability: 0,
        response_quality: 0,
        speed: 0,
        personalization: 0,
        conversation_naturalness: 0,
        usefulness: 0,
        overall_satisfaction: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const criteriaLabels = {
        design: 'Design',
        usability: 'Usability',
        response_quality: 'Response Quality',
        speed: 'Speed',
        personalization: 'Personalization',
        conversation_naturalness: 'Conversation Naturalness',
        usefulness: 'Usefulness'
    };

    useEffect(() => {
        if (isOpen) {
            fetchFeedback();
        }
    }, [isOpen]);

    const fetchFeedback = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/feedback');
            if (response.data.success) {
                setFeedback(response.data.feedback);
            }
        } catch (error) {
            console.error('Error fetching feedback:', error);
            setMessage('Error loading feedback data');
        } finally {
            setLoading(false);
        }
    };

    const handleRatingChange = (criteria, rating) => {
        setFeedback(prev => ({
            ...prev,
            [criteria]: rating
        }));
    };

    const handleTextChange = (e) => {
        setFeedback(prev => ({
            ...prev,
            overall_satisfaction: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate that all ratings are selected
        const ratingFields = ['design', 'usability', 'response_quality', 'speed', 
                             'personalization', 'conversation_naturalness', 'usefulness'];
        
        for (let field of ratingFields) {
            if (feedback[field] === 0) {
                setMessage(`Please rate ${criteriaLabels[field]}`);
                return;
            }
        }

        try {
            setLoading(true);
            setMessage('');
            
            const response = await axios.put('/api/feedback', feedback);
            
            if (response.data.success) {
                setMessage('Feedback saved successfully!');
                setTimeout(() => {
                    onClose();
                    setMessage('');
                }, 1500);
            } else {
                setMessage(response.data.message || 'Error saving feedback');
            }
        } catch (error) {
            console.error('Error saving feedback:', error);
            setMessage('Error saving feedback');
        } finally {
            setLoading(false);
        }
    };

    const renderStarRating = (criteria, currentRating) => {
        return (
            <div className="star-rating">
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        type="button"
                        className={`star ${star <= currentRating ? 'active' : ''}`}
                        onClick={() => handleRatingChange(criteria, star)}
                    >
                        ★
                    </button>
                ))}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="feedback-modal-overlay" onClick={onClose}>
            <div className="feedback-modal" onClick={e => e.stopPropagation()}>
                <div className="feedback-modal-header">
                    <h2>Application Feedback</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                
                <div className="feedback-modal-content">
                    {loading && <div className="loading">Loading...</div>}
                    
                    <form onSubmit={handleSubmit}>
                        <div className="feedback-criteria">
                            {Object.entries(criteriaLabels).map(([key, label]) => (
                                <div key={key} className="criteria-item">
                                    <label>{label}</label>
                                    {renderStarRating(key, feedback[key])}
                                </div>
                            ))}
                        </div>
                        
                        <div className="overall-satisfaction">
                            <label htmlFor="overall_satisfaction">Overall Satisfaction</label>
                            <textarea
                                id="overall_satisfaction"
                                value={feedback.overall_satisfaction}
                                onChange={handleTextChange}
                                placeholder="Please share your overall experience with the application..."
                                rows={4}
                            />
                        </div>
                        
                        {message && (
                            <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                                {message}
                            </div>
                        )}
                        
                        <div className="feedback-modal-actions">
                            <button type="button" onClick={onClose} className="cancel-btn">
                                Cancel
                            </button>
                            <button type="submit" disabled={loading} className="submit-btn">
                                {loading ? 'Saving...' : 'Save Feedback'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default FeedbackModal;
