import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const ProfileCompletion = () => {
  const [formData, setFormData] = useState({
    ageGroup: '',
    pronouns: '',
    occupation: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { fetchUser } = useAuth();

  const ageGroups = [
    '7-12', '13-16', '17-20', '21-24', 
    '25-29', '30-36', '37-49', '50-59', '60+'
  ];

  const pronounOptions = [
    'he/him', 'she/her', 'they/them'
  ];

  const occupations = [
    'Student', 'Academician', 'Engineer', 'Cook',
    'Physician', 'Architect', 'Police', 'Developer'
  ];

  const handleSelection = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.ageGroup || !formData.pronouns || !formData.occupation) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      await axios.post('/api/complete-profile', formData);
      await fetchUser(); // Refresh user data
    } catch (error) {
      setError(error.response?.data?.error || 'Error completing profile');
    } finally {
      setLoading(false);
    }
  };

  const isSelected = (field, value) => formData[field] === value;

  return (
    <div className="profile-completion-container">
      <div className="profile-completion-form">
        <h2>Complete Your Profile</h2>
        <p>Please fill in the following information to start using your account.</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          {/* Age Group Selection */}
          <div className="selection-section">
            <h3>Age Group</h3>
            <div className="selection-grid">
              {ageGroups.map((age) => (
                <button
                  key={age}
                  type="button"
                  className={`selection-box ${isSelected('ageGroup', age) ? 'selected' : ''}`}
                  onClick={() => handleSelection('ageGroup', age)}
                >
                  {age}
                </button>
              ))}
            </div>
          </div>

          {/* Pronouns Selection */}
          <div className="selection-section">
            <h3>Pronouns</h3>
            <div className="selection-grid">
              {pronounOptions.map((pronoun) => (
                <button
                  key={pronoun}
                  type="button"
                  className={`selection-box ${isSelected('pronouns', pronoun) ? 'selected' : ''}`}
                  onClick={() => handleSelection('pronouns', pronoun)}
                >
                  {pronoun}
                </button>
              ))}
            </div>
          </div>

          {/* Occupation Selection */}
          <div className="selection-section">
            <h3>Occupation</h3>
            <div className="selection-grid">
              {occupations.map((occupation) => (
                <button
                  key={occupation}
                  type="button"
                  className={`selection-box ${isSelected('occupation', occupation) ? 'selected' : ''}`}
                  onClick={() => handleSelection('occupation', occupation)}
                >
                  {occupation}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn complete-btn" disabled={loading}>
            {loading ? 'Completing...' : 'Complete Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileCompletion;
