import React, { useState } from 'react';
import { OrgProfile } from '../types';
import { Upload, X, Check, FileJson, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface ProfileUploaderProps {
  onProfileUploaded: (profile: OrgProfile) => void;
  onClose: () => void;
  closeAfterUpload?: boolean;
}

const DEFAULT_SAMPLE_JSON = `{
  "org_id": "ORG-004",
  "name": "Unseen Profile D - E-Commerce Retailer",
  "sector": "E-Commerce",
  "risk_appetite": "Medium",
  "weight_modifiers": {
    "cvss_weight": 0.25,
    "cisa_kev_weight": 0.35,
    "first_epss_weight": 0.40
  },
  "critical_products": [
    "Web Application Firewall",
    "Identity Provider SaaS"
  ]
}`;

export const ProfileUploader: React.FC<ProfileUploaderProps> = ({
  onProfileUploaded,
  onClose,
  closeAfterUpload = true,
}) => {
  const [jsonText, setJsonText] = useState<string>(DEFAULT_SAMPLE_JSON);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setJsonText(event.target.result as string);
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    setError(null);
    setUploading(true);
    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch(`${API_BASE_URL}/api/upload-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to upload profile');
      }
      const newProfile: OrgProfile = await res.json();
      onProfileUploaded(newProfile);
      if (closeAfterUpload) onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid JSON format or schema error.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '650px',
          padding: '32px',
          borderRadius: '20px',
          position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileJson size={22} color="var(--primary)" /> LOAD UNSEEN PROFILE D (DEMO READY)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Upload or paste an unseen organisation JSON profile schema to test real-time triage recalculation.
          </p>
        </div>

        {/* File Upload Input Button */}
        <div style={{ marginBottom: '16px' }}>
          <label className="btn-secondary" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer', borderStyle: 'dashed' }}>
            <Upload size={16} /> Choose JSON File from disk
            <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Textarea for JSON editing */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Profile JSON Payload
          </label>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={10}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              background: 'rgba(0, 0, 0, 0.6)',
              color: '#67e8f9',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              border: '1px solid var(--border-color)',
              outline: 'none'
            }}
          />
        </div>

        {error && (
          <div style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={uploading}>
            {uploading ? 'Processing...' : 'Load Profile & Recalculate Triage'}
          </button>
        </div>

      </div>
    </div>
  );
};
