import React, { useState, useMemo, useEffect } from 'react';
import { Search, Send, Sparkles, Users, ArrowRight, Briefcase, Tag, CheckCircle2, ArrowLeft, ExternalLink, Info, FileText, X, ChevronRight, Filter, Share2, Network, User, Bell, Clock, LogOut, Lock, Mail, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { ADVISOR_DATA } from './data';
import { Profile } from './types';


export default function App() {
  const [user, setUser] = useState<{ id: string, name: string, email: string, role: string, company: string, avatar: string } | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<'search' | 'network' | 'my-network' | 'graph'>('search');
  const [request, setRequest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<Profile[] | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // Persistent State (User Specific)
  const [requestedIntros, setRequestedIntros] = useState<Set<string>>(new Set());
  const [acceptedIntros, setAcceptedIntros] = useState<Set<string>>(new Set());

  // Load user-specific data when user changes
  useEffect(() => {
    if (user) {
      const savedRequested = localStorage.getItem(`requestedIntros_${user.id}`);
      const savedAccepted = localStorage.getItem(`acceptedIntros_${user.id}`);
      setRequestedIntros(savedRequested ? new Set(JSON.parse(savedRequested)) : new Set());
      setAcceptedIntros(savedAccepted ? new Set(JSON.parse(savedAccepted)) : new Set());
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
      setRequestedIntros(new Set());
      setAcceptedIntros(new Set());
    }
  }, [user]);

  // Sync with localStorage on change
  useEffect(() => {
    if (user) {
      localStorage.setItem(`requestedIntros_${user.id}`, JSON.stringify(Array.from(requestedIntros)));
    }
  }, [requestedIntros, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`acceptedIntros_${user.id}`, JSON.stringify(Array.from(acceptedIntros)));
    }
  }, [acceptedIntros, user]);

  const [loginName, setLoginName] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim()) return;

    const nameStr = loginName.trim();
    const initials = nameStr.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

    const u = {
      id: `user-${Date.now()}`,
      name: nameStr,
      email: `${nameStr.toLowerCase().replace(/\s+/g, '.')}@network.io`,
      role: 'Member',
      company: 'TBD',
      avatar: initials || 'U'
    };

    setUser(u);
    setActiveTab('search');
    setLoginName('');
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedProfile(null);
    setResults(null);
  };

  const handleAcceptDemo = (id: string) => {
    setAcceptedIntros(prev => new Set(prev).add(id));
  };

  const [networkSearch, setNetworkSearch] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState<string | null>(null);
  const [introFormProfile, setIntroFormProfile] = useState<Profile | null>(null);
  const [introFormState, setIntroFormState] = useState<'idle' | 'submitting' | 'success'>('idle');

  // --- Browser History Integration (Enables the Back Button) ---
  useEffect(() => {
    if (!user) return;
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');

      if (!hash) {
        // If no hash, default to search
        setActiveTab('search');
        setSelectedProfile(null);
        setIntroFormProfile(null);
        return;
      }

      if (['search', 'network', 'my-network', 'graph'].includes(hash)) {
        setActiveTab(hash as any);
        setSelectedProfile(null);
        setIntroFormProfile(null);
      } else if (hash.startsWith('intro-')) {
        const id = hash.replace('intro-', '');
        const p = ADVISOR_DATA.find(x => x.id === id);
        if (p) setIntroFormProfile(p);
      } else if (hash.startsWith('profile-')) {
        const p = ADVISOR_DATA.find(x => x.id === hash);
        if (p) {
          setSelectedProfile(p);
          setIntroFormProfile(null);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Process initial hash on refresh or login
    if (window.location.hash) handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user]);

  // Push to hash when state changes, so browser history remembers the step
  useEffect(() => {
    if (!user) return;
    let expectedHash = activeTab;
    if (introFormProfile) {
      expectedHash = `intro-${introFormProfile.id}`;
    } else if (selectedProfile) {
      expectedHash = selectedProfile.id;
    }

    if (window.location.hash !== `#${expectedHash}`) {
      window.history.pushState(null, '', `#${expectedHash}`);
    }
  }, [activeTab, selectedProfile, introFormProfile, user]);
  // -------------------------------------------------------------

  const allExpertise = useMemo(() => {
    const tags = new Set<string>();
    ADVISOR_DATA.forEach(p => p.expertise.forEach(e => tags.add(e)));
    return Array.from(tags).sort();
  }, []);

  const filteredNetwork = useMemo(() => {
    return ADVISOR_DATA.filter(p => {
      const matchesSearch = networkSearch === '' ||
        p.name.toLowerCase().includes(networkSearch.toLowerCase()) ||
        p.role.toLowerCase().includes(networkSearch.toLowerCase()) ||
        p.company.toLowerCase().includes(networkSearch.toLowerCase()) ||
        p.expertise.some(e => e.toLowerCase().includes(networkSearch.toLowerCase()));
      const matchesExpertise = !selectedExpertise || p.expertise.includes(selectedExpertise);
      return matchesSearch && matchesExpertise;
    });
  }, [networkSearch, selectedExpertise]);

  // Custom Matchmaker algorithm combining Regex + Keyword extraction with a Game Theory inspired scoring matrix
  const executeMatch = (query: string): Profile[] => {
    // 1. Regex Tokenization & Keyword Extraction
    // Extract meaningful words (3+ chars) and specific phrases (e.g. quoted text if any)
    const normalizedQuery = query.toLowerCase();
    const tokenRegex = /\b[a-z]{3,}\b/g;
    const tokens = normalizedQuery.match(tokenRegex) || [];

    // De-duplicate tokens to prevent redundant scoring
    const uniqueTokens = Array.from(new Set(tokens));

    if (uniqueTokens.length === 0) return ADVISOR_DATA.slice(0, 3);

    // 2. Game Theory Inspired Scoring (Payoff Matrix)
    // We treat this as a cooperative game where the user (Player A) wants maximum relevance, 
    // and the system (Player B) wants to minimize false positives by distributing weighted 'payoffs' 
    // based on the rarity and location of the keyword match.

    // Context Weights (The Payoff Structure)
    const PAYOFFS = {
      ROLE_EXACT: 15,    // High payoff: user is looking for a specific job title
      ROLE_PARTIAL: 8,
      COMPANY: 5,        // Medium payoff
      EXPERTISE: 10,     // High payoff: core competency match
      BIO_CONTEXT: 2     // Low payoff: speculative context
    };

    const scoredProfiles = ADVISOR_DATA.map(profile => {
      let totalScore = 0;
      let matchedFeatures = new Set<string>();

      uniqueTokens.forEach(token => {
        // Create an exact word boundary regex for precise matching
        const exactRegex = new RegExp(`\\b${token}\\b`, 'i');

        let tokenScore = 0;

        // Role Evaluation Strategy
        if (exactRegex.test(profile.role)) {
          tokenScore += PAYOFFS.ROLE_EXACT;
          matchedFeatures.add('role');
        } else if (profile.role.toLowerCase().includes(token)) {
          tokenScore += PAYOFFS.ROLE_PARTIAL;
          matchedFeatures.add('role');
        }

        // Expertise Evaluation Strategy
        const hasExpertise = profile.expertise.some(exp => exactRegex.test(exp) || exp.toLowerCase().includes(token));
        if (hasExpertise) {
          tokenScore += PAYOFFS.EXPERTISE;
          matchedFeatures.add('expertise');
        }

        // Company Evaluation Strategy
        if (profile.company.toLowerCase().includes(token)) {
          tokenScore += PAYOFFS.COMPANY;
          matchedFeatures.add('company');
        }

        // Bio/Context Evaluation Strategy (Diminishing returns to prevent bio stuffing)
        if (exactRegex.test(profile.bio)) {
          // If the profile already matched on core attributes (role/expertise), 
          // the bio match is just supplementary (lower marginal utility).
          const bioPayoff = matchedFeatures.size > 0 ? PAYOFFS.BIO_CONTEXT / 2 : PAYOFFS.BIO_CONTEXT;
          tokenScore += bioPayoff;
        }

        totalScore += tokenScore;
      });

      // Synergy Bonus (Nash Equilibrium approximation for ideal match)
      // A truly optimal match in this 'game' satisfies multiple constraints (e.g., they have the Role AND the Expertise).
      // If a profile hits multiple categories, we apply a multiplier.
      if (matchedFeatures.size >= 2) {
        totalScore = totalScore * 1.5; // 50% synergy bonus
      }

      return { profile, score: totalScore, matchCount: matchedFeatures.size };
    });

    // 3. Selection Strategy (Filtering and Sorting)
    // Filter out profiles with 0 score, sort by highest payoff, return top candidates.
    return scoredProfiles
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(p => p.profile)
      .slice(0, 3); // Returning top 3 Nash Equilibrium candidates
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.trim()) return;

    setIsSubmitting(true);
    setResults(null);

    // Simulate processing time for the complex game theory matrix evaluation
    setTimeout(() => {
      const topMatches = executeMatch(request);
      // If no matches found, fallback to initial state to prevent empty screen
      setResults(topMatches.length > 0 ? topMatches : ADVISOR_DATA.slice(0, 3));
      setIsSubmitting(false);
    }, 800);
  };

  const handleIntroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIntroFormState('submitting');
    setTimeout(() => {
      setIntroFormState('success');
      if (introFormProfile) setRequestedIntros(prev => new Set(prev).add(introFormProfile.id));
    }, 1500);
  };

  // --- LOGIN PAGE ---
  if (!user) {
    return (
      <div className="min-h-screen bg-sv-neutral-lightest flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-sv-dark-blue rounded-2xl flex items-center justify-center mx-auto shadow-xl transform hover:scale-110 transition-transform">
              <span className="text-white font-bold text-3xl">S</span>
            </div>
            <h1 className="text-3xl font-bold text-sv-dark-blue">Welcome Back</h1>
            <p className="text-sv-neutral-dark font-medium">Select a founder profile to enter the ecosystem.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-sv-neutral uppercase tracking-widest mb-2">
                Enter your name
              </label>
              <input
                type="text"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full p-4 rounded-2xl border border-sv-neutral-lighter bg-white focus:ring-4 focus:ring-sv-light-blue/10 focus:border-sv-light-blue transition-all font-medium text-lg text-sv-dark-blue placeholder:text-sv-neutral-lighter"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              disabled={!loginName.trim()}
              className="w-full flex justify-center items-center gap-2 py-4 bg-sv-dark-blue text-white font-bold rounded-2xl shadow-lg hover:bg-sv-dark-blue/90 disabled:opacity-50 transition-all text-lg"
            >
              Enter Ecosystem
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="text-center pt-8 border-t border-sv-neutral-lighter">
            <div className="flex items-center justify-center gap-2 text-sv-neutral-light mb-4">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Secure Founder Access</span>
            </div>
            <p className="text-sm text-sv-neutral">
              New to SemperVirens? <a href="#" className="text-sv-light-blue font-bold hover:underline">Apply for membership</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const Header = () => (
    <header className="bg-white/80 backdrop-blur-md border-b border-sv-neutral-lighter sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setActiveTab('search'); setSelectedProfile(null); }}>
          <div className="w-9 h-9 bg-sv-dark-blue rounded-xl flex items-center justify-center transform group-hover:scale-105 transition-transform shadow-sm">
            <span className="text-white font-sans font-bold text-xl leading-none">S</span>
          </div>
          <span className="font-sans font-bold text-xl tracking-tight text-sv-dark-blue hidden sm:inline">SemperVirens</span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { id: 'search', label: 'Matchmaker', icon: Sparkles },
            { id: 'network', label: 'Discover', icon: Users },
            { id: 'my-network', label: 'My Network', icon: User },
            { id: 'graph', label: 'Graph View', icon: Network },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setSelectedProfile(null); setIntroFormProfile(null); setResults(null); }}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-sv-dark-blue text-white shadow-md' : 'text-sv-neutral-dark hover:bg-sv-neutral-lightest'}`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden lg:inline">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <div className="text-[10px] font-bold text-sv-light-blue uppercase tracking-widest leading-none mb-1">{user.role}</div>
            <div className="text-xs font-bold text-sv-dark-blue leading-none">{user.name}</div>
          </div>
          <div className="relative group">
            <div className="w-10 h-10 rounded-full bg-sv-lavender/20 border border-sv-lavender/30 flex items-center justify-center text-sv-lavender font-bold cursor-pointer hover:shadow-lg transition-all">
              {user.avatar}
            </div>
            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl border border-sv-neutral-lighter shadow-2xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="px-4 py-3 border-b border-sv-neutral-lightest">
                <div className="text-sm font-bold text-sv-dark-blue">{user.name}</div>
                <div className="text-[10px] text-sv-neutral truncate">{user.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-sv-orange hover:bg-sv-neutral-lightest rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );

  const AdvisorCard = ({ profile, icon: Icon = ExternalLink, compact = false, showStatus = false }: { profile: Profile, icon?: any, compact?: boolean, showStatus?: boolean }) => {
    const isRequested = requestedIntros.has(profile.id);
    const isAccepted = acceptedIntros.has(profile.id);
    return (
      <motion.div
        layout
        key={profile.id}
        onClick={() => setSelectedProfile(profile)}
        className={`bg-white rounded-3xl border border-sv-neutral-lighter shadow-sm hover:shadow-xl hover:border-sv-light-blue/20 transition-all cursor-pointer group flex flex-col relative overflow-hidden ${compact ? 'p-4' : 'p-6'}`}
      >
        {showStatus && (
          <div className={`absolute top-0 right-0 px-3 py-1 border-b border-l border-sv-neutral-lighter text-[10px] font-bold uppercase tracking-widest ${isAccepted ? 'bg-green-50 text-green-600' : 'bg-sv-neutral-lightest text-sv-neutral'}`}>
            {isAccepted ? 'Connected' : 'Pending'}
          </div>
        )}
        <div className="flex gap-4 sm:gap-6">
          <div className="shrink-0 relative">
            <img src={profile.imageUrl} alt={profile.name} className={`${compact ? 'w-14 h-14' : 'w-20 h-20'} rounded-2xl object-cover border border-sv-neutral-lightest shadow-sm bg-sv-neutral-lightest`} referrerPolicy="no-referrer" />
            {isAccepted && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-bold text-sv-dark-blue truncate group-hover:text-sv-light-blue transition-colors">{profile.name}</h4>
            <div className="flex items-center gap-1.5 text-sv-neutral-dark mt-0.5">
              <Briefcase className="w-4 h-4 shrink-0 text-sv-neutral-light" />
              <span className="text-sm font-medium truncate">{profile.role}</span>
            </div>
            <div className="text-xs font-bold text-sv-light-blue uppercase tracking-widest mt-1">{profile.company}</div>
          </div>
        </div>
        {!compact && <p className="text-sv-neutral-dark text-sm leading-relaxed mt-4 line-clamp-2">{profile.bio}</p>}
      </motion.div>
    );
  };

  const ConnectionGraph = () => {
    const connectedProfiles = useMemo(() => ADVISOR_DATA.filter(p => acceptedIntros.has(p.id)), [acceptedIntros]);
    const width = 800; const height = 500; const centerX = width / 2; const centerY = height / 2;
    const graphData = useMemo(() => {
      const nodes = [{ id: 'YOU', name: 'You', x: centerX, y: centerY, type: 'user', profile: null }, ...connectedProfiles.map((p, i) => {
        const angle = (i / connectedProfiles.length) * Math.PI * 2; const radius = 180;
        return { id: p.id, name: p.name, profile: p, x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle), type: 'advisor' };
      })];
      const links: { source: string, target: string, type: 'direct' | 'org' }[] = [];
      connectedProfiles.forEach(p => links.push({ source: 'YOU', target: p.id, type: 'direct' }));
      for (let i = 0; i < connectedProfiles.length; i++) {
        for (let j = i + 1; j < connectedProfiles.length; j++) {
          if (connectedProfiles[i].company === connectedProfiles[j].company) links.push({ source: connectedProfiles[i].id, target: connectedProfiles[j].id, type: 'org' });
        }
      }
      return { nodes, links };
    }, [connectedProfiles, centerX, centerY]);

    if (connectedProfiles.length === 0) return (
      <div className="h-[600px] flex flex-col items-center justify-center text-center space-y-4 bg-white/50 rounded-[2rem] border-2 border-dashed border-sv-neutral-lighter p-12">
        <div className="w-20 h-20 bg-sv-neutral-lightest rounded-3xl flex items-center justify-center text-sv-neutral"><Network className="w-10 h-10" /></div>
        <h2 className="text-2xl font-bold">Your Network Graph</h2>
        <p className="text-sv-neutral-dark max-w-sm">Connect with advisors to build your visual network map.</p>
        <button onClick={() => setActiveTab('network')} className="px-6 py-3 bg-sv-dark-blue text-white rounded-2xl font-bold hover:bg-sv-dark-blue/90 shadow-lg shadow-sv-dark-blue/20 transition-all">Explore Network</button>
      </div>
    );

    return (
      <div className="relative bg-white rounded-[2rem] shadow-xl border border-sv-neutral-lighter h-[600px] overflow-hidden">
        <div className="absolute top-6 left-6 z-10"><h2 className="text-xl font-bold flex items-center gap-2"><Network className="w-5 h-5 text-sv-light-blue" />Ecosystem Map</h2></div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
          {graphData.links.map((link, i) => {
            const s = graphData.nodes.find(n => n.id === link.source)!; const t = graphData.nodes.find(n => n.id === link.target)!;
            return <motion.line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={link.type === 'direct' ? '#0ca2fe' : '#8977d8'} strokeWidth={2} opacity={0.4} strokeDasharray={link.type === 'org' ? "4 4" : "0"} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5 }} />;
          })}
          {graphData.nodes.map((node, i) => (
            <motion.g key={node.id} initial={{ scale: 0 }} animate={{ scale: 1, x: node.x, y: node.y }} transition={{ type: 'spring' }} className="cursor-pointer" onClick={() => node.profile && setSelectedProfile(node.profile as Profile)}>
              <circle r={node.type === 'user' ? 35 : 30} fill="white" stroke={node.type === 'user' ? '#0c1438' : '#0ca2fe'} strokeWidth={3} />
              {node.type === 'user' ? <text y="5" textAnchor="middle" className="text-[12px] font-bold fill-sv-dark-blue">YOU</text> : <><clipPath id={`c-${node.id}`}><circle r="28" /></clipPath><image href={(node.profile as Profile).imageUrl} x="-28" y="-28" width="56" height="56" clipPath={`url(#c-${node.id})`} /></>}
              <foreignObject x="-50" y="35" width="100" height="40"><div className="text-center font-bold text-[8px] text-sv-dark-blue truncate">{node.name}</div></foreignObject>
            </motion.g>
          ))}
        </svg>
      </div>
    );
  };

  if (introFormProfile) {
    if (introFormState === 'success') {
      return (
        <div className="min-h-screen bg-sv-neutral-lightest text-sv-dark-blue font-sans">
          <Header />
          <main className="max-w-2xl mx-auto px-6 py-24 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-green-50 text-green-600 border border-green-100 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm"><CheckCircle2 className="w-12 h-12" /></div>
            <h1 className="text-3xl font-bold text-sv-dark-blue mb-4">Request Sent</h1>
            <p className="text-lg text-sv-neutral-dark mb-10 leading-relaxed">Manager has received your request to connect with <strong className="text-sv-dark-blue">{introFormProfile.name}</strong>.</p>
            <button onClick={() => { setIntroFormProfile(null); setIntroFormState('idle'); }} className="px-8 py-4 bg-sv-dark-blue text-white font-bold rounded-2xl hover:bg-sv-dark-blue/90 shadow-lg">Return to Profile</button>
          </main>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-sv-neutral-lightest text-sv-dark-blue font-sans">
        <Header />
        <main className="max-w-3xl mx-auto px-6 py-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button onClick={() => setIntroFormProfile(null)} className="mb-8 flex items-center gap-2 text-sm font-bold text-sv-neutral hover:text-sv-dark-blue transition-colors group">
            <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1" /> BACK TO {introFormProfile.name.toUpperCase()}
          </button>
          <form onSubmit={handleIntroSubmit} className="bg-white rounded-3xl border border-sv-neutral-lighter shadow-lg p-8 space-y-8">
            <h1 className="text-3xl font-bold">Request Introduction</h1>
            <div className="flex items-center gap-4 py-4 px-6 bg-sv-neutral-lightest rounded-2zl border border-sv-neutral-lighter">
              <img src={introFormProfile.imageUrl} alt={introFormProfile.name} className="w-14 h-14 rounded-xl object-cover" />
              <div><div className="text-[10px] font-bold text-sv-neutral uppercase">Target</div><div className="text-lg font-bold">{introFormProfile.name}</div></div>
            </div>
            <div className="space-y-4"><label className="block text-xs font-bold uppercase tracking-widest">Context</label><textarea required className="w-full min-h-[120px] p-5 rounded-2xl border border-sv-neutral-lighter bg-sv-neutral-lightest focus:bg-white transition-all resize-none" /></div>
            <div className="space-y-4"><label className="block text-xs font-bold uppercase tracking-widest">Forwardable Blurb</label><textarea required className="w-full min-h-[140px] p-5 rounded-2xl border border-sv-neutral-lighter bg-sv-neutral-lightest focus:bg-white transition-all resize-none" /></div>
            <div className="pt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIntroFormProfile(null)} className="px-6 py-4 font-bold text-sv-neutral-dark">Cancel</button>
              <button type="submit" disabled={introFormState === 'submitting'} className="px-10 py-4 bg-sv-dark-blue text-white font-bold rounded-2xl shadow-lg disabled:opacity-70">{introFormState === 'submitting' ? "Sending..." : "Send Request"}</button>
            </div>
          </form>
        </main>
      </div>
    );
  }

  if (selectedProfile) {
    const isAccepted = acceptedIntros.has(selectedProfile.id);
    const isRequested = requestedIntros.has(selectedProfile.id);
    return (
      <div className="min-h-screen bg-sv-neutral-lightest text-sv-dark-blue font-sans">
        <Header />
        <main className="max-w-4xl mx-auto px-6 py-12 animate-in fade-in duration-300">
          <button onClick={() => setSelectedProfile(null)} className="mb-8 flex items-center gap-2 text-sm font-bold text-sv-neutral hover:text-sv-dark-blue group"><ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1" /> BACK</button>
          <div className="bg-white rounded-[2.5rem] border border-sv-neutral-lighter shadow-2xl overflow-hidden">
            <div className="h-48 bg-sv-dark-blue relative opacity-90"><div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:20px_20px] opacity-10"></div></div>
            <div className="px-8 sm:px-12 pb-12">
              <div className="relative flex flex-col sm:flex-row justify-between items-end -mt-20 mb-10 gap-6">
                <img src={selectedProfile.imageUrl} className="w-40 h-40 rounded-3xl object-cover border-8 border-white bg-white shadow-xl" />
                <div className="flex gap-3 w-full sm:w-auto">
                  {isRequested && !isAccepted && <button onClick={() => handleAcceptDemo(selectedProfile.id)} className="flex-1 sm:flex-none px-8 py-4 bg-sv-lavender text-white font-bold rounded-2xl shadow-lg hover:scale-105 transition-all">Accept Intro (Demo)</button>}
                  <button onClick={() => !isRequested && setIntroFormProfile(selectedProfile)} disabled={isRequested} className={`flex-1 sm:flex-none px-8 py-4 rounded-2xl font-bold font-lg transition-all shadow-lg ${isRequested ? 'bg-sv-neutral-lightest text-sv-neutral-dark border border-sv-neutral-lighter' : 'bg-sv-dark-blue text-white hover:bg-sv-dark-blue/90'}`}>{isAccepted ? "Connected" : isRequested ? "Requested" : "Request Intro"}</button>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                  <div><h1 className="text-4xl font-bold mb-3">{selectedProfile.name}</h1><div className="text-lg font-medium text-sv-neutral-dark">{selectedProfile.role} @ <span className="text-sv-dark-blue font-bold">{selectedProfile.company}</span></div></div>
                  <div><h2 className="text-xs font-bold text-sv-neutral uppercase tracking-widest border-b border-sv-neutral-lightest pb-2 mb-4">Experience</h2><p className="text-sv-dark-blue/80 leading-relaxed text-xl font-medium">{selectedProfile.bio}</p></div>
                </div>
                <div className="bg-sv-neutral-lightest rounded-3xl p-8"><h2 className="text-xs font-bold text-sv-dark-blue uppercase tracking-widest mb-6">Expertise</h2><div className="flex flex-wrap gap-2">{selectedProfile.expertise.map(t => <span key={t} className="px-4 py-2 bg-white rounded-xl text-sm font-bold shadow-sm border border-sv-neutral-lighter">{t}</span>)}</div></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sv-neutral-lightest text-sv-dark-blue font-sans">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {activeTab === 'search' && (
            <motion.div key="search" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-4xl mx-auto space-y-12">
              <div className="space-y-6 text-center sm:text-left">
                <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-sv-dark-blue leading-tight">Scale your <span className="bg-gradient-to-r from-sv-lavender via-sv-salmon to-sv-orange bg-clip-text text-transparent">Power Network.</span></h1>
                <p className="text-xl text-sv-neutral-dark max-w-2xl leading-relaxed font-medium">Find the specific bridging connections you need for your ecosystem goals.</p>
              </div>
              <div className="bg-white rounded-[2.5rem] shadow-2xl border border-sv-neutral-lightest overflow-hidden focus-within:ring-8 focus-within:ring-sv-light-blue/5 transition-all">
                <form onSubmit={handleSubmit}>
                  <textarea value={request} onChange={(e) => setRequest(e.target.value)} placeholder="e.g. 'A VP of Sales at an Enterprise HR-tech company...'" className="w-full min-h-[180px] p-8 text-xl bg-transparent border-none resize-none focus:ring-0 font-medium" />
                  <div className="px-8 py-6 bg-sv-neutral-lightest flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs font-bold text-sv-neutral uppercase tracking-widest flex items-center gap-2"><Clock className="w-4 h-4" /> {requestedIntros.size} ecosystem requests</div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      {results && <button type="button" onClick={() => { setResults(null); setRequest(''); }} className="px-6 py-4 bg-white border border-sv-neutral-lighter rounded-2xl font-bold">Reset</button>}
                      <button type="submit" disabled={!request.trim() || isSubmitting || results !== null} className="flex-1 sm:flex-none px-10 py-4 bg-sv-dark-blue text-white font-bold rounded-2xl shadow-xl disabled:opacity-50">{isSubmitting ? "Scanning..." : "Scan Network"}</button>
                    </div>
                  </div>
                </form>
              </div>
              {results && <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in-up duration-500">{results.map(p => <AdvisorCard key={p.id} profile={p} />)}</div>}
            </motion.div>
          )}
          {activeTab === 'network' && (
            <motion.div key="network" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-72 shrink-0 space-y-6"><div className="bg-white p-6 rounded-3xl border border-sv-neutral-lighter shadow-sm space-y-6"><input type="text" placeholder="Search leaders..." value={networkSearch} onChange={e => setNetworkSearch(e.target.value)} className="w-full p-3 rounded-xl border border-sv-neutral-lighter bg-sv-neutral-lightest text-sm focus:bg-white transition-all" />
                <div className="space-y-2"><label className="text-[10px] font-bold text-sv-neutral uppercase tracking-widest">Expertise</label><div className="max-h-60 overflow-y-auto space-y-1">{allExpertise.map(e => <button key={e} onClick={() => setSelectedExpertise(selectedExpertise === e ? null : e)} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${selectedExpertise === e ? 'bg-sv-dark-blue text-white' : 'hover:bg-sv-neutral-lightest'}`}>{e}</button>)}</div></div></div></div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filteredNetwork.map(p => <AdvisorCard key={p.id} profile={p} />)}</div>
            </motion.div>
          )}
          {activeTab === 'my-network' && (
            <motion.div key="my-network" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1"><div className="bg-white p-8 rounded-[2rem] border border-sv-neutral-lighter shadow-xl text-center"><div className="w-24 h-24 bg-sv-lavender/20 rounded-3xl flex items-center justify-center text-sv-lavender font-bold text-4xl mx-auto mb-4 border border-sv-lavender/30 shadow-inner">{user.avatar}</div><h2 className="text-xl font-bold">{user.name}</h2><p className="text-sv-neutral text-sm font-medium">{user.role} @ {user.company}</p><div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-sv-neutral-lightest"><div className="text-center"><div className="text-2xl font-bold text-sv-dark-blue">{requestedIntros.size}</div><div className="text-[10px] font-bold text-sv-neutral uppercase tracking-widest">Sent</div></div><div className="text-center"><div className="text-2xl font-bold text-sv-light-blue">{acceptedIntros.size}</div><div className="text-[10px] font-bold text-sv-neutral uppercase tracking-widest">Connected</div></div></div></div></div>
                <div className="lg:col-span-3 space-y-8">
                  <h2 className="text-2xl font-bold flex items-center gap-3"><Users className="w-6 h-6 text-sv-light-blue" />Active Connections</h2>
                  {acceptedIntros.size === 0 ? <div className="bg-white rounded-[2rem] border-2 border-dashed border-sv-neutral-lighter p-20 text-center"><p className="text-sv-neutral">Requests will appear here once accepted.</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{ADVISOR_DATA.filter(p => acceptedIntros.has(p.id)).map(p => <AdvisorCard key={p.id} profile={p} showStatus />)}</div>}
                  {requestedIntros.size > acceptedIntros.size && <div className="pt-12 space-y-6"><h2 className="text-2xl font-bold flex items-center gap-3"><Clock className="w-6 h-6 text-sv-orange" />Pending Requests</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-70">{ADVISOR_DATA.filter(p => requestedIntros.has(p.id) && !acceptedIntros.has(p.id)).map(p => <AdvisorCard key={p.id} profile={p} showStatus />)}</div></div>}
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'graph' && <motion.div key="graph" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}><ConnectionGraph /></motion.div>}
        </AnimatePresence>
      </main>
    </div>
  );
}
