import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Profile = ({ handlePersonaUpdate }) => {
  const [persona, setPersona] = useState({
    role: 'friend',
    backstory: '',
    personality_traits: [],
    interests: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const roleOptions = [
    { value: 'friend', label: 'Friend', description: 'Friendly and supportive, uses slangs sometimes', image: 'friend.png' },
    { value: 'boyfriend', label: 'Boyfriend', description: 'Romantic and protective', image: 'boyfriend.png' },
    { value: 'girlfriend', label: 'Girlfriend', description: 'Romantic and caring', image: 'girlfriend.png' },
    { value: 'spouse_male', label: 'Spouse (Male)', description: 'Deep commitment and partnership', image: 'spouse_male.png' },
    { value: 'spouse_female', label: 'Spouse (Female)', description: 'Deep commitment and partnership', image: 'spouse_female.png' },
    { value: 'brother', label: 'Brother', description: 'Protective and playful', image: 'brother.png' },
    { value: 'sister', label: 'Sister', description: 'Compassionate and understanding', image: 'sister.png' },
    { value: 'mentor', label: 'Mentor', description: 'Wise and guiding', image: 'mentor.png' },
    { value: 'advisor', label: 'Advisor', description: 'Professional and analytical', image: 'advisor.png' },
    { value: 'academician', label: 'Academician', description: 'Scholarly and educational', image: 'academician.png' }
  ];

  const personalityTraits = [
    'Confident', 'Shy', 'Energetic', 'Mellow', 'Caring', 
    'Sassy', 'Practical', 'Dreamy', 'Artistic', 'Logical'
  ];

  const interests = [
    'Board games', 'Comics', 'Manga', 'History', 'Philosophy',
    'Cooking & Baking', 'Anime', 'Basketball', 'Football', 'Sci-fi',
    'Sneakers', 'Gardening', 'Skincare & Makeup', 'Cars', 'Space',
    'Soccer', 'K-pop', 'Fitness', 'Physics', 'Mindfulness'
  ];

  useEffect(() => {
    loadPersona();
  }, []);

  const loadPersona = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/persona');
      if (response.data.success) {
        setPersona(response.data.persona);
      }
    } catch (error) {
      console.error('Error loading persona:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePersona = async () => {
    try {
      setSaving(true);
      const response = await axios.put('/api/persona', persona);
      if (response.data.success) {
        if (handlePersonaUpdate) {
          handlePersonaUpdate(persona);
        }
      }
    } catch (error) {
      console.error('Error saving persona:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetPersona = async () => {
    if (window.confirm('Are you sure you want to reset the AI persona to default settings?')) {
      try {
        await axios.delete('/api/persona/reset');
        setPersona({
          role: 'friend',
          backstory: '',
          personality_traits: [],
          interests: []
        });
      } catch (error) {
        console.error('Error resetting persona:', error);
      }
    }
  };

  const handleRoleChange = (role) => {
    setPersona({ ...persona, role });
  };

  const handleBackstoryChange = (e) => {
    setPersona({ ...persona, backstory: e.target.value });
  };

  const toggleTrait = (trait) => {
    const currentTraits = persona.personality_traits;
    const newTraits = currentTraits.includes(trait)
      ? currentTraits.filter(t => t !== trait)
      : [...currentTraits, trait];
    setPersona({ ...persona, personality_traits: newTraits });
  };

  const toggleInterest = (interest) => {
    const currentInterests = persona.interests;
    const newInterests = currentInterests.includes(interest)
      ? currentInterests.filter(i => i !== interest)
      : [...currentInterests, interest];
    setPersona({ ...persona, interests: newInterests });
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  const selectedRole = roleOptions.find(role => role.value === persona.role);

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2>👤 AI Persona</h2>
        <p>
          Define who your AI assistant is, how they should behave, and what topics
          they should be knowledgeable about.
        </p>
        <div className="profile-actions">
          <button 
            className="save-profile-btn" 
            onClick={savePersona}
            disabled={saving}
          >
            {saving ? 'Saving...' : '💾 Save'}
          </button>
          <button 
            className="reset-profile-btn" 
            onClick={resetPersona}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Role Selection */}
      <div className="profile-section">
        <h3>AI's Role</h3>
        <p className="section-description">
          Choose what kind of relationship you want with your AI assistant
        </p>
        <div className="role-grid">
          {roleOptions.map(role => (
            <div 
              key={role.value}
              className={`role-card ${persona.role === role.value ? 'selected' : ''}`}
              onClick={() => handleRoleChange(role.value)}
            >
              <img 
                src={`/drawing/${role.image}`} 
                alt={role.label} 
                className="role-image"
              />
              <div className="role-label">{role.label}</div>
              <div className="role-description">{role.description}</div>
            </div>
          ))}
        </div>
        {selectedRole && (
          <div className="current-selection">
            <strong>Selected:</strong> {selectedRole.label} - {selectedRole.description}
          </div>
        )}
      </div>

      {/* Backstory */}
      <div className="profile-section">
        <h3>Backstory</h3>
        <p className="section-description">
          This text influences how the AI will behave. It shapes its personality.
        </p>
        <textarea
          className="backstory-input"
          value={persona.backstory}
          onChange={handleBackstoryChange}
          placeholder="Example: You are very understanding and patient. You always try to stay positive and give people hope. When faced with difficult situations, you remain calm and offer practical solutions..."
          rows={6}
        />
        <div className="character-count">
          {persona.backstory.length}/500 characters
        </div>
      </div>

      {/* Personality Traits */}
      <div className="profile-section">
        <h3>Personality Traits</h3>
        <p className="section-description">
          Select the personality traits you want your AI to have (multiple selection)
        </p>
        <div className="traits-grid">
          {personalityTraits.map(trait => (
            <button
              key={trait}
              className={`trait-button ${persona.personality_traits.includes(trait) ? 'selected' : ''}`}
              onClick={() => toggleTrait(trait)}
            >
              {trait}
            </button>
          ))}
        </div>
        <div className="selection-count">
          {persona.personality_traits.length} traits selected
        </div>
      </div>

      {/* Interests */}
      <div className="profile-section">
        <h3>Interests</h3>
        <p className="section-description">
          Select topics you want your AI to be knowledgeable and interested in (multiple selection)
        </p>
        <div className="interests-grid">
          {interests.map(interest => (
            <button
              key={interest}
              className={`interest-button ${persona.interests.includes(interest) ? 'selected' : ''}`}
              onClick={() => toggleInterest(interest)}
            >
              {interest}
            </button>
          ))}
        </div>
        <div className="selection-count">
          {persona.interests.length} interests selected
        </div>
      </div>

      <div className="profile-info">
        <h4>💡 How It Works</h4>
        <ul>
          <li>The selected role determines the AI's overall behavior style</li>
          <li>The backstory deeply shapes the AI's character</li>
          <li>Personality traits influence the AI's response style</li>
          <li>Interests determine which topics the AI will provide more detailed information about</li>
          <li>All settings take effect immediately and personalize your chats</li>
        </ul>
      </div>
    </div>
  );
};

export default Profile;
