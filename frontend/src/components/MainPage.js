import React, { useState, useContext, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Chat from './Chat';
import Memory from './Memory';
import Diary from './Diary';
import Profile from './Profile';
import FeedbackModal from './FeedbackModal';
import axios from 'axios';

const MainPage = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  const [persona, setPersona] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  useEffect(() => {
    fetchPersona();
  }, []);

  const fetchPersona = async () => {
    try {
      const response = await axios.get('/api/persona');
      console.log('Persona response:', response.data);
      console.log('Persona traits:', response.data.persona?.personality_traits);
      setPersona(response.data.persona);
    } catch (error) {
      console.error('Error fetching persona information:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle persona updates from Profile component
  const handlePersonaUpdate = (updatedPersona) => {
    setPersona(updatedPersona);
  };

  const getRoleImage = (role) => {
    // Use exact role names that match the drawing files
    const roleImages = {
      academician: '/drawing/academician.png',
      advisor: '/drawing/advisor.png',
      boyfriend: '/drawing/boyfriend.png',
      brother: '/drawing/brother.png',
      friend: '/drawing/friend.png',
      girlfriend: '/drawing/girlfriend.png',
      mentor: '/drawing/mentor.png',
      sister: '/drawing/sister.png',
      spouse_female: '/drawing/spouse_female.png',
      spouse_male: '/drawing/spouse_male.png'
    };
    return roleImages[role] || '/drawing/friend.png';
  };

  const getRoleName = (role) => {
    // Use exact role names that match the selection
    const roleNames = {
      academician: 'Academician',
      advisor: 'Advisor', 
      boyfriend: 'Boyfriend',
      brother: 'Brother',
      friend: 'Friend',
      girlfriend: 'Girlfriend',
      mentor: 'Mentor',
      sister: 'Sister',
      spouse_female: 'Spouse Female',
      spouse_male: 'Spouse Male'
    };
    return roleNames[role] || 'AI Assistant';
  };

  const getTraitName = (trait) => {
    const traitNames = {
      empathetic: 'empathetic',
      analytical: 'analytical',
      creative: 'creative',
      supportive: 'supportive',
      humorous: 'humorous',
      professional: 'professional',
      friendly: 'friendly',
      patient: 'patient',
      energetic: 'energetic',
      wise: 'wise',
      curious: 'curious',
      optimistic: 'optimistic',
      practical: 'practical',
      logical: 'logical',
      confident: 'confident'
    };
    return traitNames[trait] || trait;
  };

  const tabs = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'memory', label: 'Memory', icon: '🧠' },
    { id: 'diary', label: 'Diary', icon: '📔' },
    { id: 'profile', label: 'Profile', icon: '👤' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <div className="tab-content">
            <Chat />
          </div>
        );
      case 'memory':
        return (
          <div className="tab-content">
            <h2>🧠 Memory</h2>
            <Memory />
          </div>
        );
      case 'diary':
        return (
          <div className="tab-content">
            <h2>📔 Diary</h2>
            <Diary />
          </div>
        );
      case 'profile':
        return (
          <div className="tab-content">
            <h2>👤 Profile</h2>
            <Profile handlePersonaUpdate={handlePersonaUpdate} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="main-layout">
      <div className="sidebar">
        <div className="app-header">
          <img 
            src="/drawing/logo.png" 
            alt="Termini Logo" 
            className="app-logo"
            onClick={() => setActiveTab('chat')}
            style={{ cursor: 'pointer' }}
          />
          <h1 
            className="app-name"
            onClick={() => setActiveTab('chat')}
            style={{ cursor: 'pointer' }}
          >
            Termini
          </h1>
        </div>
        
        <div className="persona-info">
          {loading ? (
            <div className="loading-persona">
              <div className="loading-spinner"></div>
              <p>Loading persona information...</p>
            </div>
          ) : persona ? (
            <div className="persona-details">
              <div className="persona-header">
                <div className="persona-role-icon-large">
                  <img src={getRoleImage(persona.role)} alt={getRoleName(persona.role)} />
                </div>
                <div className="persona-role-info-large">
                  <h2 className="persona-role-name-large">{getRoleName(persona.role)}</h2>
                  {persona.personality_traits && persona.personality_traits.length > 0 && (
                    <div className="persona-traits-inline">
                      {persona.personality_traits.map((trait, index) => (
                        <span key={index}>
                          <span className="trait-inline">{getTraitName(trait)}</span>
                          {index < persona.personality_traits.length - 1 && <span className="trait-separator">, </span>}
                        </span>
                      ))}
                    </div>
                  )}
                  {(!persona.personality_traits || persona.personality_traits.length === 0) && (
                    <div className="persona-traits-inline">
                      <span className="trait-inline">No personality traits selected yet</span>
                    </div>
                  )}
                </div>
              </div>
              
              {persona.backstory && (
                <div className="persona-backstory">
                  <h4>Backstory</h4>
                  <p className="backstory-text">{persona.backstory}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="no-persona">
              <div className="default-ai-icon">🤖</div>
              <h3>Default AI</h3>
              <p>No persona selected yet</p>
              <button 
                className="setup-persona-btn"
                onClick={() => setActiveTab('profile')}
              >
                Set Up Persona
              </button>
            </div>
          )}
        </div>
        
        <div className="sidebar-footer">
          <div className="user-info-mini">
            <span className="username">{user?.username}</span>
          </div>
          <button 
            className="feedback-btn"
            onClick={() => setShowFeedbackModal(true)}
          >
            📝 Feedback
          </button>
          <button className="logout-btn" onClick={logout}>
            Sign Out
          </button>
        </div>
      </div>
      
      <div className="main-content">
        <div className="top-navigation">
          <div className="tab-indicator" style={{
            transform: `translateX(${tabs.findIndex(tab => tab.id === activeTab) * 100}%)`,
            width: `${100 / tabs.length}%`
          }}></div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
        
        <div className="content-area">
          {renderTabContent()}
        </div>
      </div>
      
      {showFeedbackModal && (
        <FeedbackModal 
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
    </div>
  );
};

export default MainPage;
