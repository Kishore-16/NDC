import React, { useEffect, useState } from 'react';
import { Ban, ShieldX } from 'lucide-react';
import { OrgProfile, NegativeTestItem } from '../types';
import { apiFetch } from '../api';
import { TriageSkeleton } from './LoadingSkeleton';

interface NegativeTestViewProps { profile: OrgProfile | null; }

export const NegativeTestView: React.FC<NegativeTestViewProps> = ({ profile }) => {
  const [items, setItems] = useState<NegativeTestItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (profile) void fetchNegativeTests(); }, [profile]);
  const fetchNegativeTests = async () => {
    if (!profile) return;
    setLoading(true);
    try { const response = await apiFetch(`/api/negative-test/${encodeURIComponent(profile.org_id)}`); const data = await response.json(); setItems(data.negative_tests || []); }
    catch (error) { console.error('Error fetching negative tests:', error); }
    finally { setLoading(false); }
  };

  return <div className="negative-test-view">
    <section className="validation-intro negative-intro"><ShieldX size={21} /><div><p>Relevance check</p><h2>High severity does not always mean high priority.</h2><span>These vulnerabilities are excluded because they are outside {profile?.name}'s critical inventory.</span></div></section>
    {loading ? <TriageSkeleton count={2} /> : !items.length ? <div className="glass-panel negative-empty">No high-CVSS excluded vulnerabilities found for this profile.</div> : <div className="negative-list">{items.map((item) => <article className="negative-card" key={item.cve_id}>
      <div className="negative-card-main"><header><span className="negative-status">Excluded</span><code>{item.cve_id}</code></header><p className="negative-label">Affected asset</p><h3>{item.product_name}</h3><p className="negative-summary">Not listed as a critical product for this organisation, so it is intentionally left out of the priority queue.</p><div className="negative-facts"><span><b>CVSS</b>{item.cvss_base_score.toFixed(1)}</span><span><b>EPSS</b>{(item.first_epss * 100).toFixed(1)}%</span><span><b>KEV</b>{item.cisa_kev ? 'Known exploited' : 'Not listed'}</span></div></div>
      <aside className="negative-outcome"><Ban size={25} /><p>Decision</p><strong>Not relevant</strong><span>Outside critical inventory</span></aside>
    </article>)}</div>}
  </div>;
};
