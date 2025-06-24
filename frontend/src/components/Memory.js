import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Memory = () => {
  const [memory, setMemory] = useState({
    family_friends: [],
    favorites: [],
    opinions: [],
    skills: [],
    personality: [],
    health: [],
    others: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newItem, setNewItem] = useState('');

  const categoryLabels = {
    family_friends: 'Family & Friends',
    favorites: 'Favorites',
    opinions: 'Opinions',
    skills: 'Skills',
    personality: 'Personality',
    health: 'Health',
    others: 'Other'
  };

  const categoryIcons = {
    family_friends: '👨‍👩‍👧‍👦',
    favorites: '❤️',
    opinions: '💭',
    skills: '🎯',
    personality: '🌟',
    health: '🏥',
    others: '📝'
  };

  useEffect(() => {
    loadMemory();
  }, []);

  const loadMemory = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/memory');
      if (response.data.success) {
        setMemory(response.data.memory);
      }
    } catch (error) {
      console.error('Error loading memory:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveMemory = async () => {
    try {
      setSaving(true);
      const response = await axios.put('/api/memory', memory);
      if (response.data.success) {
        // Success feedback could be added here
      }
    } catch (error) {
      console.error('Error saving memory:', error);
    } finally {
      setSaving(false);
    }
  };

  const addItem = (category) => {
    if (newItem.trim()) {
      const updatedMemory = {
        ...memory,
        [category]: [...memory[category], newItem.trim()]
      };
      setMemory(updatedMemory);
      setNewItem('');
      setEditingCategory(null);
    }
  };

  const removeItem = (category, index) => {
    const updatedMemory = {
      ...memory,
      [category]: memory[category].filter((_, i) => i !== index)
    };
    setMemory(updatedMemory);
  };

  const clearAllMemory = async () => {
    if (window.confirm('Are you sure you want to delete all memory data?')) {
      try {
        await axios.delete('/api/memory/clear');
        setMemory({
          family_friends: [],
          favorites: [],
          opinions: [],
          skills: [],
          personality: [],
          health: [],
          others: []
        });
      } catch (error) {
        console.error('Error clearing memory:', error);
      }
    }
  };

  const handleKeyPress = (e, category) => {
    if (e.key === 'Enter') {
      addItem(category);
    } else if (e.key === 'Escape') {
      setEditingCategory(null);
      setNewItem('');
    }
  };

  if (loading) {
    return (
      <div className="memory-container">
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <p>Loading memory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="memory-container">
      <div className="memory-header">
        <h2>🧠 Personal Memory</h2>
        <p>
          Your personal information learned during conversations is stored here and
          used to personalize future responses.
        </p>
        <div className="memory-actions">
          <button 
            className="save-memory-btn" 
            onClick={saveMemory}
            disabled={saving}
          >
            {saving ? 'Saving...' : '💾 Save'}
          </button>
          <button 
            className="clear-memory-btn" 
            onClick={clearAllMemory}
          >
            🗑️ Clear All
          </button>
        </div>
      </div>

      <div className="memory-categories">
        {Object.keys(categoryLabels).map(category => (
          <div key={category} className="memory-category">
            <div className="category-header">
              <h3>
                <span className="category-icon">{categoryIcons[category]}</span>
                {categoryLabels[category]}
                <span className="item-count">({memory[category].length})</span>
              </h3>
              <button 
                className="add-item-btn"
                onClick={() => setEditingCategory(category)}
              >
                + Add
              </button>
            </div>

            <div className="category-content">
              {memory[category].length === 0 ? (
                <div className="empty-category">
                  <p>No {categoryLabels[category].toLowerCase()} information yet</p>
                  <small>Will be added automatically during conversation</small>
                </div>
              ) : (
                <div className="memory-items">
                  {memory[category].map((item, index) => (
                    <div key={index} className="memory-item">
                      <span className="item-text">{item}</span>
                      <button 
                        className="remove-item-btn"
                        onClick={() => removeItem(category, index)}
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {editingCategory === category && (
                <div className="add-item-form">
                  <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, category)}
                    placeholder={`Add new ${categoryLabels[category].toLowerCase()}...`}
                    autoFocus
                  />
                  <div className="form-actions">
                    <button onClick={() => addItem(category)}>Add</button>
                    <button onClick={() => {
                      setEditingCategory(null);
                      setNewItem('');
                    }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="memory-info">
        <h4>💡 How It Works</h4>
        <ul>
          <li>Personal information you mention in conversations is automatically categorized</li>
          <li>This information is used to personalize future responses for you</li>
          <li>You can manually add or remove information at any time</li>
          <li>All data is stored securely and only accessible to you</li>
        </ul>
      </div>
    </div>
  );
};

export default Memory;
