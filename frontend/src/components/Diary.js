import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import './Diary.css';

const Diary = () => {
    const [diaryEntries, setDiaryEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDiaryEntries();
        
        // Set up auto-refresh every 10 seconds to show live updates
        const interval = setInterval(fetchDiaryEntries, 10000);
        
        return () => clearInterval(interval);
    }, []);

    const fetchDiaryEntries = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/diary');
            setDiaryEntries(response.data.diary_entries || []);
        } catch (error) {
            console.error('Diary entries fetch error:', error);
            setError('Failed to load diary entries');
        } finally {
            setLoading(false);
        }
    };

    const deleteDiaryEntry = async (entryId) => {
        try {
            await axios.delete(`/api/diary/${entryId}`);
            setDiaryEntries(diaryEntries.filter(entry => entry._id !== entryId));
        } catch (error) {
            console.error('Diary entry deletion error:', error);
            setError('Failed to delete diary entry');
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="diary-container">
                <div className="loading">Loading diary entries...</div>
            </div>
        );
    }

    return (
        <div className="diary-container">
            <div className="diary-header">
                <h2>📖 My Diary</h2>
                <p>Summaries of your chat conversations are automatically stored here</p>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="diary-entries">
                {diaryEntries.length === 0 ? (
                    <div className="empty-diary">
                        <div className="empty-icon">📝</div>
                        <h3>No diary entries yet</h3>
                        <p>Diary entries are automatically created after your chat conversations are completed</p>
                    </div>
                ) : (
                    diaryEntries.map((entry) => (
                        <div key={entry._id} className="diary-entry">
                            <div className="entry-header">
                                <h3 className="entry-title">{entry.title}</h3>
                                <div className="entry-meta">
                                    <span className="entry-date">{formatDate(entry.date)}</span>
                                    <span className="message-count">{entry.message_count} messages</span>
                                    <button 
                                        className="delete-btn"
                                        onClick={() => deleteDiaryEntry(entry._id)}
                                        title="Delete"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                            <div className="entry-summary">
                                {entry.summary}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Diary;
