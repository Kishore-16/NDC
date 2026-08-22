import React, { useState, useEffect } from 'react';
import { OrgProfile, TriageItem } from './types';
import { Header } from './components/Header';
import { ProfileSelector } from './components/ProfileSelector';
import { Top5Feed } from './components/Top5Feed';
import { ExplanationModal } from './components/ExplanationModal';
import { CompareMode } from './components/CompareMode';
import { NegativeTestView } from './components/NegativeTestView';
import { GoldSetEvalView } from './components/GoldSetEvalView';
import { ProfileUploader } from './components/ProfileUploader';
import { VulnerabilityTable } from './components/VulnerabilityTable';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { LandingAuth } from './components/LandingAuth';

import { API_BASE_URL } from './config';

export const App: React.FC = () => {
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('nexora_auth_token'));
  const [profiles, setProfiles] = useState<OrgProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<OrgProfile | null>(null);
  const [activeTab, setActiveTab] = useState<string>('triage');
  const [top5, setTop5] = useState<TriageItem[]>([]);
  const [inventory, setInventory] = useState<TriageItem[]>([]);
  const [selectedExplanationItem, setSelectedExplanationItem] = useState<TriageItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch profiles
  useEffect(() => {
    if (authToken) {
      fetchProfiles();
    }
  }, [authToken]);

  // Recalculate triage whenever activeProfile changes
  useEffect(() => {
    if (activeProfile) {
      runTriage(activeProfile);
    }
  }, [activeProfile]);

  const fetchProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/profiles`);
      if (!res.ok) throw new Error('Failed to load profiles from backend.');
      const data: OrgProfile[] = await res.json();
      setProfiles(data);
      if (data.length > 0) {
        // Default to Startup (ORG-002) if available, or first org
        const startup = data.find((p) => p.org_id === 'ORG-002') || data[0];
        setActiveProfile(startup);
      }
    } catch (err: any) {
      setError(err.message || 'Cannot connect to backend server. Make sure FastAPI server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  const runTriage = async (profile: OrgProfile) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profile })
      });
      if (!res.ok) throw new Error('Triage recalculation failed');
      const data = await res.json();
      setTop5(data.top_5 || []);
      setInventory(data.inventory || []);
    } catch (err: any) {
      console.error('Triage error:', err);
    }
  };

  const handleProfileUploaded = (newProfile: OrgProfile) => {
    setProfiles((prev) => [...prev.filter((p) => p.org_id !== newProfile.org_id), newProfile]);
    setActiveProfile(newProfile);
    setActiveTab('triage');
  };

  if (!authToken) {
    return <LandingAuth onEnterApp={(token) => { localStorage.setItem('nexora_auth_token', token); setAuthToken(token); }} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProfile={activeProfile}
        onOpenUpload={() => setShowUploadModal(true)}
      />

      {/* Main Container */}
      <main style={{ width: '100%', maxWidth: '1320px', margin: '0 auto', padding: '0 24px 60px 24px', flex: '1' }}>
        
        {error ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#f87171', border: '1px solid var(--urgent-red)' }}>
            <AlertCircle size={36} style={{ marginBottom: '12px' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Connection Error</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: '20px' }}>
              {error}
            </p>
            <button onClick={fetchProfiles} className="btn-primary">
              <RefreshCw size={16} /> Retry Connection
            </button>
          </div>
        ) : loading ? (
          <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.1rem', color: '#ffffff' }}>Loading Triage Engine...</h3>
          </div>
        ) : (
          <>
            {/* Profile Selector (shown across tabs) */}
            <ProfileSelector
              profiles={profiles}
              activeProfile={activeProfile}
              onSelectProfile={(p) => setActiveProfile(p)}
            />

            {/* Tab Views */}
            {activeTab === 'triage' && (
              <Top5Feed
                top5={top5}
                profile={activeProfile}
                onSelectItem={(item) => setSelectedExplanationItem(item)}
              />
            )}

            {activeTab === 'compare' && (
              <CompareMode profiles={profiles} />
            )}

            {activeTab === 'negative' && (
              <NegativeTestView profile={activeProfile} />
            )}

            {activeTab === 'goldset' && (
              <GoldSetEvalView profile={activeProfile} />
            )}

            {activeTab === 'inventory' && (
              <VulnerabilityTable inventory={inventory} />
            )}
          </>
        )}

      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '20px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        NEXORA Personalised Vulnerability Triage Platform v2.0 • 24-Hour Hackathon MVP • Deterministic Decision Engine
      </footer>

      {/* Modals */}
      {selectedExplanationItem && (
        <ExplanationModal
          item={selectedExplanationItem}
          profile={activeProfile}
          onClose={() => setSelectedExplanationItem(null)}
        />
      )}

      {showUploadModal && (
        <ProfileUploader
          onProfileUploaded={handleProfileUploaded}
          onClose={() => setShowUploadModal(false)}
        />
      )}

    </div>
  );
};

export default App;
