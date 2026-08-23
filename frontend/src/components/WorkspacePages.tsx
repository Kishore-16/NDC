import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Flame, Layers3, Search, ShieldAlert, Sparkles, Star, Target } from 'lucide-react';
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { CompareMode } from './CompareMode';
import { GoldSetEvalView } from './GoldSetEvalView';
import { NegativeTestView } from './NegativeTestView';
import { ProfileSelector } from './ProfileSelector';
import { ProfileUploader } from './ProfileUploader';
import { VulnerabilityTable } from './VulnerabilityTable';
import { Skeleton, TableSkeleton, TriageSkeleton } from './LoadingSkeleton';
import { apiFetch } from '../api';
import { OrgProfile, TriageItem } from '../types';

export interface WorkspaceContext { profiles: OrgProfile[]; activeProfile: OrgProfile; selectProfile: (profile: OrgProfile) => void; top5: TriageItem[]; inventory: TriageItem[]; triageLoading: boolean; showingCachedTriage: boolean; onProfileUploaded: (profile: OrgProfile) => void; customProfileIds: string[]; deleteCustomProfile: (profile: OrgProfile) => Promise<void>; setVulnerabilityFixed: (cveId: string, fixed: boolean) => Promise<void>; }
const useWorkspace = () => useOutletContext<WorkspaceContext>();
const profileQuery = (profile: OrgProfile) => `?profile=${encodeURIComponent(profile.org_id)}`;
const score = (item: TriageItem) => item.score_breakdown.final_score.toFixed(1);

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <header className="page-heading"><p>{eyebrow}</p><h1>{title}</h1><div>{children}</div></header>;
}

export function AppOverview() {
  const { activeProfile, top5, inventory, triageLoading, showingCachedTriage } = useWorkspace(); const urgent = top5.filter((item) => item.priority_label.toLowerCase() === 'urgent').length;
  const epssWeight = Math.round(activeProfile.weight_modifiers.first_epss_weight * 100);
  return <div className="page-stack"><PageHeading eyebrow="Current security priority landscape" title={`Good to see you, ${activeProfile.name}.`}><p>Personalised decisions grounded in your organisation’s risk profile.</p></PageHeading>
    <section className="metric-grid">{triageLoading && !showingCachedTriage ? <MetricSkeletons /> : <><Metric value={inventory.length || '—'} label="Vulnerabilities analysed" /><Metric value={top5.length || '—'} label="Priority actions" /><Metric value={activeProfile.critical_products.length} label="Critical products" /><Metric value={`${epssWeight}%`} label="EPSS weighting" /></>}</section>
    {triageLoading && showingCachedTriage && <RefreshNotice />}
    <section className="overview-grid"><div className="priority-panel"><div><p>Current priority</p>{triageLoading && !showingCachedTriage ? <><Skeleton className="skeleton-heading" /><Skeleton className="skeleton-line short" /></> : <><h2>{top5.length} actions require attention</h2><span><i className="dot urgent" /> {urgent} urgent <i className="dot high" /> {Math.max(top5.length - urgent, 0)} other priorities</span></>}</div><Link className="btn-primary" to={`/app/triage${profileQuery(activeProfile)}`}>Open triage <ArrowRight size={16} /></Link></div>
      <div className="overview-panel"><p>Highest signal</p><strong>{epssWeight >= 50 ? 'Exploitation likelihood' : 'Confirmed exploitation'}</strong><span>{epssWeight >= 50 ? 'EPSS carries the most weight for this profile.' : 'CISA KEV and CVSS are strong decision inputs.'}</span></div></section>
    <section className="quick-actions"><Link to={`/app/triage${profileQuery(activeProfile)}`}><ShieldAlert size={19} /><span><strong>Review Top 5</strong><small>See what needs attention first</small></span><ArrowRight size={17} /></Link><Link to={`/app/compare${profileQuery(activeProfile)}`}><Layers3 size={19} /><span><strong>Compare profiles</strong><small>Show how context changes decisions</small></span><ArrowRight size={17} /></Link><Link to={`/app/negative-test${profileQuery(activeProfile)}`}><Target size={19} /><span><strong>Validate relevance</strong><small>Inspect high-CVSS exclusions</small></span><ArrowRight size={17} /></Link></section>
  </div>;
}
function Metric({ value, label }: { value: string | number; label: string }) { return <div className="metric-card"><strong>{value}</strong><span>{label}</span></div>; }
function MetricSkeletons() { return <>{Array.from({ length: 4 }, (_, index) => <div className="metric-card" key={index}><Skeleton className="skeleton-metric" /><Skeleton className="skeleton-label" /></div>)}</>; }
function RefreshNotice() { return <div className="refresh-notice"><span /> Refreshing the latest ranking for this organisation…</div>; }

export function TriagePage() {
  const { activeProfile, top5, triageLoading, showingCachedTriage, setVulnerabilityFixed } = useWorkspace(); const [filter, setFilter] = useState('all'); const [updatingCve, setUpdatingCve] = useState('');
  const items = filter === 'all' ? top5 : top5.filter((item) => item.priority_label.toLowerCase() === filter);
  const markFixed = async (cveId: string) => { setUpdatingCve(cveId); try { await setVulnerabilityFixed(cveId, true); } finally { setUpdatingCve(''); } };
  return <div className="page-stack"><PageHeading eyebrow={`Ranked for ${activeProfile.name}`} title="Your Top 5"><p>Focus on the vulnerabilities that matter to this organisation first.</p></PageHeading><div className="filter-bar"><div>{['all', 'urgent', 'high', 'medium'].map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'selected' : ''}>{item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}</button>)}</div><span>Sorted by personalised score</span></div>{triageLoading && showingCachedTriage && <RefreshNotice />}{triageLoading && !showingCachedTriage ? <TriageSkeleton /> : <div className="triage-list">{items.map((item) => <TriageCard item={item} profile={activeProfile} key={item.cve_id} onMarkFixed={markFixed} isUpdating={updatingCve === item.cve_id} />)}{!items.length && <EmptyState title="No matching priorities" detail="Try a different severity filter." />}</div>}</div>;
}

function TriageCard({ item, profile, onMarkFixed, isUpdating }: { item: TriageItem; profile: OrgProfile; onMarkFixed: (cveId: string) => Promise<void>; isUpdating: boolean }) {
  const priority = item.priority_label.toLowerCase();
  return <article className={`triage-card priority-${priority}`}><div className="triage-rank">#{item.rank}</div><div className="triage-card-main"><div className="triage-meta"><span className={`badge badge-${priority === 'urgent' ? 'urgent' : priority === 'high' ? 'high' : 'medium'}`}>{item.priority_label}</span><code>{item.cve_id}</code>{item.cisa_kev && <span className="signal signal-kev"><Flame size={13} /> KEV</span>}</div><h2>{item.plain_title}</h2><p className="triage-product">{item.product_name}{item.score_breakdown.is_critical_product && <span><Star size={13} fill="currentColor" /> Critical product</span>}</p><div className="signal-grid"><span><b>EPSS</b>{(item.first_epss * 100).toFixed(1)}%</span><span><b>CVSS</b>{item.cvss_base_score.toFixed(1)}</span><span><b>Signal</b>{item.cisa_kev ? 'Actively exploited' : 'Context ranked'}</span></div><TriageReason item={item} /></div><div className="triage-card-score"><strong>{score(item)}</strong><span>/ 100</span><Link className="btn-primary" to={`/app/triage/${encodeURIComponent(item.cve_id)}${profileQuery(profile)}`}>View decision <ArrowRight size={15} /></Link><button className="mark-fixed-button" type="button" onClick={() => void onMarkFixed(item.cve_id)} disabled={isUpdating}>{isUpdating ? 'Updating…' : <><CheckCircle2 size={14} /> Mark fixed</>}</button></div></article>;
}

function TriageReason({ item }: { item: TriageItem }) { const b = item.score_breakdown; return <div className="triage-reason"><span>Priority drivers</span><div>{b.is_critical_product && <b>Critical asset</b>}{item.cisa_kev && <b>Known exploited</b>}<b>EPSS {(item.first_epss * 100).toFixed(1)}%</b><b>CVSS {item.cvss_base_score.toFixed(1)}</b></div></div>; }

export function TriageDetailPage() {
  const { activeProfile, top5, inventory, triageLoading, showingCachedTriage } = useWorkspace(); const { cveId } = useParams(); const navigate = useNavigate();
  const item = [...top5, ...inventory].find((candidate) => candidate.cve_id === cveId);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [remediationPlan, setRemediationPlan] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  useEffect(() => { setAiExplanation(''); setAiError(''); setAiLoading(false); setRemediationPlan(''); setPlanError(''); setPlanLoading(false); }, [activeProfile.org_id, cveId]);
  const explainWithAi = async () => {
    if (!item || aiLoading) return;
    setAiLoading(true); setAiError('');
    try {
      const response = await apiFetch(`/api/triage/${encodeURIComponent(item.cve_id)}/ai-explanation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_id: activeProfile.org_id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.explanation !== 'string') throw new Error(data.detail || 'Unable to generate an AI explanation.');
      setAiExplanation(data.explanation);
    } catch (reason) { setAiError(reason instanceof Error ? reason.message : 'Unable to generate an AI explanation.'); }
    finally { setAiLoading(false); }
  };
  const createPlan = async () => {
    if (!item || planLoading) return;
    setPlanLoading(true); setPlanError('');
    try {
      const response = await apiFetch(`/api/triage/${encodeURIComponent(item.cve_id)}/remediation-plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_id: activeProfile.org_id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.plan !== 'string') throw new Error(data.detail || 'Unable to generate a remediation path.');
      setRemediationPlan(data.plan);
    } catch (reason) { setPlanError(reason instanceof Error ? reason.message : 'Unable to generate a remediation path.'); }
    finally { setPlanLoading(false); }
  };
  if (triageLoading && !showingCachedTriage) return <div className="page-stack"><TriageSkeleton count={1} /></div>;
  if (!item) return <EmptyState title="Vulnerability not found" detail="This CVE is not available for the selected organisation profile." action={<button className="btn-primary" onClick={() => navigate(`/app/triage${profileQuery(activeProfile)}`)}><ArrowLeft size={16} /> Back to triage</button>} />;
  const b = item.score_breakdown;
  const contributions = [['EPSS', b.epss_contrib, '#38bdf8'], ['CISA KEV', b.kev_contrib, '#f59e0b'], ['CVSS', b.cvss_contrib, '#f87171'], ['Critical product', b.critical_product_boost, '#fbbf24']].filter(([, value]) => Number(value) > 0) as [string, number, string][];
  return <div className="page-stack decision-page"><Link className="back-link" to={`/app/triage${profileQuery(activeProfile)}`}><ArrowLeft size={16} /> Back to triage</Link><PageHeading eyebrow={`${item.priority_label} · ${item.cve_id}`} title={item.plain_title}><p>{item.product_name} for {activeProfile.name}</p></PageHeading><section className="decision-hero"><div className="decision-score"><p>Personalised score</p><strong>{score(item)}<small>/100</small></strong><span>{item.cisa_kev ? 'Confirmed exploitation signal present' : 'Ranked using organisation context'}</span></div><div className="decision-evidence"><p>Why this ranks #{item.rank}</p><h2>Key signals make this a priority.</h2><div className="decision-signal-list">{b.is_critical_product && <DecisionSignal title="Critical asset" detail={`${item.product_name} is marked critical for ${activeProfile.name}.`} value={`+${b.critical_product_boost.toFixed(1)} pts`} icon={<Star size={15} fill="currentColor" />} />}{item.cisa_kev && <DecisionSignal title="Known exploitation" detail="This vulnerability appears in the CISA Known Exploited Vulnerabilities catalog." value={`+${b.kev_contrib.toFixed(1)} pts`} icon={<Flame size={15} />} />}{!item.cisa_kev && <DecisionSignal title="Exploitation likelihood" detail={`EPSS estimates a ${(item.first_epss * 100).toFixed(1)}% chance of exploitation.`} value={`+${b.epss_contrib.toFixed(1)} pts`} icon={<Target size={15} />} />}<DecisionSignal title={item.cisa_kev ? 'Exploitation likelihood' : 'Technical severity'} detail={item.cisa_kev ? `EPSS estimates a ${(item.first_epss * 100).toFixed(1)}% chance of exploitation.` : `CVSS technical severity is ${item.cvss_base_score.toFixed(1)} out of 10.`} value={item.cisa_kev ? `+${b.epss_contrib.toFixed(1)} pts` : `+${b.cvss_contrib.toFixed(1)} pts`} icon={item.cisa_kev ? <Target size={15} /> : <ShieldAlert size={15} />} /></div></div></section><section className="decision-grid"><div className="decision-panel"><h2>Decision breakdown</h2>{contributions.map(([name, value, color]) => <div className="contribution" key={name}><div><span>{name}</span><b>+{value.toFixed(1)}</b></div><i><em style={{ width: `${Math.min(value, 100)}%`, background: color }} /></i></div>)}</div><div className="decision-panel"><h2>Why this matters</h2><div className="fact-list"><Fact label="Exploitation" value={item.cisa_kev ? 'Confirmed in CISA KEV' : 'Not currently in CISA KEV'} /><Fact label="Likelihood" value={`EPSS ${(item.first_epss * 100).toFixed(1)}%`} /><Fact label="Organisational relevance" value={b.is_critical_product ? `${item.product_name} is a critical product` : item.product_name} /></div></div></section><section className="ai-explanation-panel"><div><p>AI-assisted explanation</p><h2>Understand this decision in context</h2><span>Uses the displayed CVE evidence and your organisation profile. It does not change the deterministic score.</span></div><button className="btn-secondary ai-explain-button" type="button" onClick={explainWithAi} disabled={aiLoading}>{aiLoading ? <><span className="button-spinner" /> Explaining…</> : <><Sparkles size={16} /> Explain with AI</>}</button></section>{aiError && <div className="ai-explanation-error" role="alert">{aiError}</div>}{aiExplanation && <AiExplanation explanation={aiExplanation} />}<section className="safe-action"><CheckCircle2 size={22} /><div><p>Next safe action</p><strong>{item.safe_next_action}</strong></div><button className="btn-secondary plan-button" type="button" onClick={createPlan} disabled={planLoading}>{planLoading ? <><span className="button-spinner" /> Building plan…</> : <><Sparkles size={16} /> Build action plan</>}</button></section>{planError && <div className="ai-explanation-error" role="alert">{planError}</div>}{remediationPlan && <RemediationPlan plan={remediationPlan} />}<section className="provenance-panel"><div><p>Source & provenance</p><strong>{item.provenance_sources.join(' · ')}</strong></div><div><p>Confidence</p><strong>{item.confidence_level} — {item.confidence_reason}</strong></div>{item.reference_url && <a href={item.reference_url} target="_blank" rel="noreferrer">View source <ExternalLink size={14} /></a>}</section></div>;
}

function DecisionSignal({ title, detail, value, icon }: { title: string; detail: string; value: string; icon: React.ReactNode }) { return <article className="decision-signal"><span className="decision-signal-icon">{icon}</span><div><strong>{title}</strong><p>{detail}</p></div><b>{value}</b></article>; }

const briefingHeadings = ['Why it matters', 'Why it is ranked this way', 'Recommended next step'];
function AiExplanation({ explanation }: { explanation: string }) {
  const cleaned = explanation.replace(/```[a-z-]*|```|\*\*/gi, '').replace(/^\s*[-•]\s*/gm, '').trim();
  const headingPattern = /(?:^|\n)\s*(?:#{1,6}\s*)?(Why it matters|Why it is ranked this way|Recommended next step)\s*:?\s*/gi;
  const matches = [...cleaned.matchAll(headingPattern)];
  const sections = matches.length ? matches.map((match, index) => ({ title: match[1], body: cleaned.slice((match.index || 0) + match[0].length, matches[index + 1]?.index).trim() })).filter((section) => section.body) : [{ title: 'Decision briefing', body: cleaned }];
  return <section className="ai-explanation-result"><header><div className="ai-orb"><Sparkles size={17} /></div><div><p>AI decision briefing</p><strong>Evidence-informed interpretation</strong></div></header><div className="ai-briefing-grid">{sections.map((section, index) => <article key={`${section.title}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{briefingHeadings.includes(section.title) ? section.title : 'Decision briefing'}</h3>{section.body.split(/\n{2,}/).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{sentenceCase(paragraph.replace(/\n/g, ' ').trim())}</p>)}</div></article>)}</div></section>;
}
function RemediationPlan({ plan }: { plan: string }) { const steps = plan.replace(/```[a-z-]*|```|\*\*/gi, '').split(/\n+/).map((step) => step.replace(/^\s*(?:step\s*)?\d+[.:\-]\s*/i, '').trim()).filter(Boolean); return <section className="remediation-plan"><header><div className="ai-orb"><CheckCircle2 size={17} /></div><div><p>AI action path</p><strong>Level-by-level safe remediation</strong></div></header><div className="remediation-levels">{steps.map((step, index) => <article key={`${step}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><b>Level {index + 1}</b><p>{sentenceCase(step)}</p></div></article>)}</div></section>; }
function sentenceCase(value: string) { const letters = value.replace(/[^A-Za-z]/g, ''); if (!letters || letters !== letters.toUpperCase()) return value; const lowered = value.toLowerCase().replace(/\b(cve|cvss|epss|cisa|kev|ai)\b/g, (word) => word.toUpperCase()); return lowered.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`); }
function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
export function ComparePage() { const { profiles } = useWorkspace(); return <div className="page-stack"><PageHeading eyebrow="Context-aware ranking" title="Same threats. Different priorities."><p>See how organisation context changes vulnerability decisions.</p></PageHeading><CompareMode profiles={profiles} /></div>; }
export function NegativeTestPage() { const { activeProfile } = useWorkspace(); return <div className="page-stack"><PageHeading eyebrow="Relevance validation" title="Does NEXORA understand relevance?"><p>A high CVSS score does not automatically mean high organisational priority.</p></PageHeading><NegativeTestView profile={activeProfile} /></div>; }
export function GoldSetPage() { const { activeProfile } = useWorkspace(); return <div className="page-stack"><PageHeading eyebrow="Decision quality" title="Gold Set Evaluation"><p>Validate rankings against practitioner-ranked priorities.</p></PageHeading><GoldSetEvalView profile={activeProfile} /></div>; }

export function InventoryPage() {
  const { inventory, activeProfile, triageLoading, showingCachedTriage } = useWorkspace(); const [params] = useSearchParams(); const search = params.get('search') || '';
  return <div className="page-stack"><PageHeading eyebrow={`${inventory.length} records for ${activeProfile.name}`} title="Vulnerability Inventory"><p>Search the supplied data and inspect the contextual triage score.</p></PageHeading>{triageLoading && showingCachedTriage && <RefreshNotice />}{search && <div className="workspace-inline-note"><Search size={16} /> Search filter requested: “{search}”</div>}{triageLoading && !showingCachedTriage ? <TableSkeleton rows={7} /> : <VulnerabilityTable inventory={inventory} profileId={activeProfile.org_id} />}</div>;
}
export function FixedCvesPage() {
  const { inventory, activeProfile, triageLoading, showingCachedTriage, setVulnerabilityFixed } = useWorkspace(); const [updatingCve, setUpdatingCve] = useState('');
  const fixed = Array.from(new Map(inventory.filter((item) => item.is_fixed).map((item) => [item.cve_id, item])).values()); const criticalFixed = fixed.filter((item) => item.score_breakdown.is_critical_product).length;
  const reopen = async (cveId: string) => { setUpdatingCve(cveId); try { await setVulnerabilityFixed(cveId, false); } finally { setUpdatingCve(''); } };
  return <div className="page-stack fixed-cves-page"><PageHeading eyebrow={`Resolution history · ${activeProfile.name}`} title="Fixed vulnerabilities"><p>Completed items stay out of active triage while remaining visible for review.</p></PageHeading>{triageLoading && showingCachedTriage && <RefreshNotice />}{triageLoading && !showingCachedTriage ? <TriageSkeleton count={2} /> : <><section className="fixed-summary"><div><CheckCircle2 size={21} /><span><strong>{fixed.length}</strong><small>Fixed CVEs</small></span></div><div><strong>{criticalFixed}</strong><span>Critical assets remediated</span></div><Link to={`/app/triage${profileQuery(activeProfile)}`}>Open active triage <ArrowRight size={15} /></Link></section>{fixed.length ? <section className="fixed-cve-list">{fixed.map((item) => <article key={item.cve_id}><div className="fixed-cve-icon"><CheckCircle2 size={17} /></div><div><div className="fixed-cve-meta"><code>{item.cve_id}</code><span>Fixed</span></div><h2>{item.product_name}</h2><p>Previously ranked #{item.rank || '—'} · CVSS {item.cvss_base_score.toFixed(1)} · EPSS {(item.first_epss * 100).toFixed(1)}%</p></div><button className="reopen-button" type="button" disabled={updatingCve === item.cve_id} onClick={() => void reopen(item.cve_id)}>{updatingCve === item.cve_id ? 'Reopening…' : 'Reopen in triage'}</button></article>)}</section> : <EmptyState title="No fixed CVEs yet" detail="When you mark a Top 5 item fixed, it will appear here and the next relevant CVE will enter triage." action={<Link className="btn-primary" to={`/app/triage${profileQuery(activeProfile)}`}>Review Top 5 <ArrowRight size={16} /></Link>} />}</>}</div>;
}
export function ProfilesPage() { const { profiles, activeProfile, selectProfile, customProfileIds, deleteCustomProfile } = useWorkspace(); return <div className="page-stack"><PageHeading eyebrow="Organisation context" title="Organisation Profiles"><p>Select the organisation whose risk preferences should shape every decision. Custom profiles can be removed here.</p></PageHeading><ProfileSelector profiles={profiles} activeProfile={activeProfile} onSelectProfile={selectProfile} customProfileIds={customProfileIds} onDeleteProfile={deleteCustomProfile} /></div>; }
export function ProfileCustomPage() { const { onProfileUploaded, activeProfile } = useWorkspace(); const navigate = useNavigate(); return <ProfileUploader closeAfterUpload={false} onProfileUploaded={(profile) => { onProfileUploaded(profile); navigate(`/app/profiles${profileQuery(profile)}`); }} onClose={() => navigate(`/app/profiles${profileQuery(activeProfile)}`)} />; }
function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) { return <section className="empty-state"><AlertTriangle size={28} /><h1>{title}</h1><p>{detail}</p>{action}</section>; }
