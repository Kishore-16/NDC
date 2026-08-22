import React, { useState } from 'react';
import { TriageItem, OrgProfile } from '../types';
import { X, ShieldAlert, Check, Copy, ExternalLink, Calculator, Layers, Award, FileText, AlertTriangle, CheckCircle } from 'lucide-react';

interface ExplanationModalProps {
  item: TriageItem | null;
  profile: OrgProfile | null;
  onClose: () => void;
}

export const ExplanationModal: React.FC<ExplanationModalProps> = ({
  item,
  profile,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!item || !profile) return null;

  const b = item.score_breakdown;

  const handleCopyAction = () => {
    navigator.clipboard.writeText(item.safe_next_action);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '32px',
          borderRadius: '20px',
          position: 'relative',
          border: '1px solid var(--border-glow)'
        }}
      >
        {/* Close Button */}
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

        {/* Modal Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{
              background: item.rank === 1 ? 'var(--urgent-red)' : 'var(--primary)',
              color: 'white',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              fontSize: '0.9rem',
              padding: '2px 10px',
              borderRadius: '6px'
            }}>
              RANK #{item.rank}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {item.cve_id}
            </span>
            <span className="badge badge-urgent">{item.priority_label}</span>
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', lineHeight: '1.3' }}>
            {item.plain_title}
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#93c5fd', marginTop: '4px' }}>
            Affecting <strong style={{ color: '#ffffff' }}>{item.product_name}</strong> for {profile.name}
          </p>
        </div>

        {/* Breakdown Card: Mathematical Calculation */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={18} color="var(--accent-cyan)" /> Personalised Score Breakdown
            </h3>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#60a5fa' }}>
              Total: {b.final_score.toFixed(1)} / 100
            </div>
          </div>

          {/* Mathematical Formula Display */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '8px', color: '#94a3b8', marginBottom: '16px' }}>
            Final Score = (CVSS_norm × {b.cvss_weight_pct}%) + (KEV_val × {b.kev_weight_pct}%) + (EPSS × {b.epss_weight_pct}%) + Critical_Boost
          </div>

          {/* Contribution Progress Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* CVSS Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <span>CVSS Base Score ({item.cvss_base_score}/10)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#f87171', fontWeight: 600 }}>+{b.cvss_contrib.toFixed(1)} pts</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(b.cvss_contrib / 100) * 100}%`, background: '#ef4444', height: '100%' }} />
              </div>
            </div>

            {/* KEV Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <span>CISA KEV Exploitation ({item.cisa_kev ? 'Confirmed YES' : 'NO'})</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#fbbf24', fontWeight: 600 }}>+{b.kev_contrib.toFixed(1)} pts</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(b.kev_contrib / 100) * 100}%`, background: '#f59e0b', height: '100%' }} />
              </div>
            </div>

            {/* EPSS Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <span>FIRST EPSS Exploitation Prob ({(item.first_epss * 100).toFixed(1)}%)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#60a5fa', fontWeight: 600 }}>+{b.epss_contrib.toFixed(1)} pts</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(b.epss_contrib / 100) * 100}%`, background: '#3b82f6', height: '100%' }} />
              </div>
            </div>

            {/* Critical Product Bonus */}
            {b.is_critical_product && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fef08a', background: 'rgba(245, 158, 11, 0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <span>⭐ Critical Product Context Bonus</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>+{b.critical_product_boost.toFixed(1)} pts</span>
              </div>
            )}

          </div>
        </div>

        {/* Detailed Plain Language Explanation */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--primary)" /> Why Does It Matter to {profile.name}?
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            {item.why_ranked_here}
          </p>
        </div>

        {/* Recommended Safe Next Action */}
        <div style={{ marginBottom: '24px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} /> Recommended Safe Next Action
            </h3>
            <button
              onClick={handleCopyAction}
              style={{
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy Action'}
            </button>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: '1.5', fontWeight: 500 }}>
            {item.safe_next_action}
          </p>
        </div>

        {/* Provenance & Source Evidence */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.8rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Data Provenance</div>
            <div style={{ color: '#ffffff', fontWeight: 600 }}>{item.provenance_sources.join(' | ')}</div>
            <a
              href={item.reference_url}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#60a5fa', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}
            >
              View Official NVD Record <ExternalLink size={12} />
            </a>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Confidence Score</div>
            <div style={{ color: '#34d399', fontWeight: 700 }}>{item.confidence_level} Confidence</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>{item.confidence_reason}</div>
          </div>
        </div>

      </div>
    </div>
  );
};
