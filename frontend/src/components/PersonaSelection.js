import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './PersonaSelection.css';

const PersonaSelection = () => {
    const navigate = useNavigate();
    const { fetchUser } = useAuth();
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedTraits, setSelectedTraits] = useState([]);
    const [backstory, setBackstory] = useState('');
    const [interests, setInterests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const roles = [
        { id: 'friend', name: 'Friend', image: '/drawing/friend.png' },
        { id: 'boyfriend', name: 'Boyfriend', image: '/drawing/boyfriend.png' },
        { id: 'girlfriend', name: 'Girlfriend', image: '/drawing/girlfriend.png' },
        { id: 'spouse_male', name: 'Spouse (Male)', image: '/drawing/spouse_male.png' },
        { id: 'spouse_female', name: 'Spouse (Female)', image: '/drawing/spouse_female.png' },
        { id: 'brother', name: 'Brother', image: '/drawing/brother.png' },
        { id: 'sister', name: 'Sister', image: '/drawing/sister.png' },
        { id: 'mentor', name: 'Mentor', image: '/drawing/mentor.png' },
        { id: 'advisor', name: 'Advisor', image: '/drawing/advisor.png' },
        { id: 'academician', name: 'Academician', image: '/drawing/academician.png' }
    ];

    const availableTraits = [
        'Confident', 'Shy', 'Energetic', 'Mellow', 'Caring', 'Sassy', 
        'Practical', 'Dreamy', 'Artistic', 'Logical'
    ];

    const availableInterests = [
        'Board games', 'Comics', 'Manga', 'History', 'Philosophy', 
        'Cooking & Baking', 'Anime', 'Basketball', 'Football', 'Sci-fi', 
        'Sneakers', 'Gardening', 'Skincare & Makeup', 'Cars', 'Space', 
        'Soccer', 'K-pop', 'Fitness', 'Physics', 'Mindfulness'
    ];

    const handleTraitToggle = (trait) => {
        setSelectedTraits(prev => 
            prev.includes(trait) 
                ? prev.filter(t => t !== trait)
                : [...prev, trait]
        );
    };

    const handleInterestToggle = (interest) => {
        setInterests(prev => 
            prev.includes(interest) 
                ? prev.filter(i => i !== interest)
                : [...prev, interest]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedRole) {
            alert('Please select a persona role');
            return;
        }

        setIsLoading(true);

        try {
            const personaData = {
                role: selectedRole,
                personality_traits: selectedTraits,
                backstory: backstory.trim(),
                interests: interests
            };

            // Save persona data
            await axios.put('/api/persona', personaData);
            
            // Mark persona selection as complete
            await axios.post('/api/complete-persona-selection');
            
            // Update user state to trigger navigation
            await fetchUser();
            
            // Navigate to main page
            navigate('/');
        } catch (error) {
            console.error('Error saving persona:', error);
            alert('Failed to save persona. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = async () => {
        setIsLoading(true);
        try {
            // Mark persona selection as complete even if skipped
            await axios.post('/api/complete-persona-selection');
            
            // Update user state to trigger navigation
            await fetchUser();
            
            // Navigate to main page without setting persona
            navigate('/');
        } catch (error) {
            console.error('Error completing persona selection:', error);
            // Navigate anyway
            navigate('/');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="persona-selection-container">
            <div className="persona-selection-card">
                <h2>Choose Your AI Persona</h2>
                <p className="persona-selection-subtitle">
                    Select the type of AI assistant you'd like to interact with. You can change this anytime in the Profiles tab.
                </p>

                <form onSubmit={handleSubmit}>
                    {/* Role Selection */}
                    <div className="section">
                        <h3>Select Role</h3>
                        <div className="roles-grid">
                            {roles.map(role => (
                                <div 
                                    key={role.id}
                                    className={`role-card ${selectedRole === role.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedRole(role.id)}
                                >
                                    <img src={role.image} alt={role.name} />
                                    <span>{role.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Personality Traits */}
                    <div className="section">
                        <h3>Personality Traits (Optional)</h3>
                        <div className="traits-grid">
                            {availableTraits.map(trait => (
                                <button
                                    key={trait}
                                    type="button"
                                    className={`trait-button ${selectedTraits.includes(trait) ? 'selected' : ''}`}
                                    onClick={() => handleTraitToggle(trait)}
                                >
                                    {trait}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Backstory */}
                    <div className="section">
                        <h3>Backstory (Optional)</h3>
                        <textarea
                            value={backstory}
                            onChange={(e) => setBackstory(e.target.value)}
                            placeholder="Describe your AI's background and personality..."
                            rows="4"
                        />
                    </div>

                    {/* Interests */}
                    <div className="section">
                        <h3>Interests (Optional)</h3>
                        <div className="interests-grid">
                            {availableInterests.map(interest => (
                                <button
                                    key={interest}
                                    type="button"
                                    className={`interest-button ${interests.includes(interest) ? 'selected' : ''}`}
                                    onClick={() => handleInterestToggle(interest)}
                                >
                                    {interest}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-actions">
                        <button 
                            type="submit" 
                            className="submit-button"
                            disabled={isLoading || !selectedRole}
                        >
                            {isLoading ? 'Saving...' : 'Continue'}
                        </button>
                        <button 
                            type="button" 
                            className="skip-button"
                            onClick={handleSkip}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Saving...' : 'Skip for Now'}
                        </button>
                    </div>

                    <p className="help-text">
                        You can change these settings anytime in the Profiles tab.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default PersonaSelection;
