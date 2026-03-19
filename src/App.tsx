import React, { useState, useMemo, useEffect } from 'react';
import { Search, Send, Sparkles, Users, ArrowRight, Briefcase, Tag, CheckCircle2, ArrowLeft, ExternalLink, Info, FileText, X, ChevronRight, Filter, Share2, Network, User, Bell, Clock, LogOut, Lock, Mail, ShieldCheck, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { ADVISOR_DATA } from './data';
import { Profile } from './types';


export default function App() {
  const [user, setUser] = useState<{ id: string, name: string, email: string, role: string, company: string, avatar: string } | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<'search' | 'network' | 'my-network' | 'graph' | 'messages'>('search');
  const [request, setRequest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<Profile[] | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // Persistent State (User Specific)
  const [requestedIntros, setRequestedIntros] = useState<Set<string>>(new Set());
  const [acceptedIntros, setAcceptedIntros] = useState<Set<string>>(new Set());

  // Messaging & Notifications
  const [messages, setMessages] = useState<Record<string, { id: string, sender: 'me' | 'them', text: string, timestamp: number }[]>>({});
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<{ id: string, text: string, profileId?: string }[]>([]);

  const notify = (text: string, profileId?: string) => {
    const id = Date.now().toString();
    setNotifications(n => [...n, { id, text, profileId }]);
    setTimeout(() => setNotifications(n => n.filter(x => x.id !== id)), 5000);
  };

  const ToastContainer = () => (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20 }}
            className={`pointer-events-auto bg-sv-dark-blue text-white pl-4 pr-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-sm relative group ${n.profileId ? 'cursor-pointer hover:bg-sv-dark-blue/90 hover:-translate-y-1 transition-all duration-300' : ''}`}
            onClick={() => {
              if (n.profileId) {
                const p = ADVISOR_DATA.find(x => x.id === n.profileId);
                if (p) setSelectedProfile(p);
                setNotifications(prev => prev.filter(x => x.id !== n.id));
              }
            }}
          >
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-sv-light-blue" />
            </div>
            <div className="font-medium text-sm leading-snug pr-4">{n.text}</div>
            <button onClick={(e) => { e.stopPropagation(); setNotifications(prev => prev.filter(x => x.id !== n.id)); }} className="absolute top-2 right-2 text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  // Load user-specific data when user changes
  useEffect(() => {
    if (user) {
      const savedRequested = localStorage.getItem(`requestedIntros_${user.id}`);
      const savedAccepted = localStorage.getItem(`acceptedIntros_${user.id}`);
      const savedMessages = localStorage.getItem(`messages_${user.id}`);

      setRequestedIntros(savedRequested ? new Set(JSON.parse(savedRequested)) : new Set());
      setAcceptedIntros(savedAccepted ? new Set(JSON.parse(savedAccepted)) : new Set());
      setMessages(savedMessages ? JSON.parse(savedMessages) : {});
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
      setRequestedIntros(new Set());
      setAcceptedIntros(new Set());
      setMessages({});
      setActiveMessageId(null);
    }
  }, [user]);

  // Sync with localStorage on change
  useEffect(() => {
    if (user) {
      localStorage.setItem(`requestedIntros_${user.id}`, JSON.stringify(Array.from(requestedIntros)));
      localStorage.setItem(`acceptedIntros_${user.id}`, JSON.stringify(Array.from(acceptedIntros)));
      localStorage.setItem(`messages_${user.id}`, JSON.stringify(messages));
    }
  }, [requestedIntros, acceptedIntros, messages, user]);

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
        setActiveMessageId(null);
        return;
      }

      if (['search', 'network', 'my-network', 'graph', 'messages'].includes(hash)) {
        setActiveTab(hash as any);
        setSelectedProfile(null);
        setIntroFormProfile(null);
        setActiveMessageId(null);
      } else if (hash.startsWith('intro-')) {
        const id = hash.replace('intro-', '');
        const p = ADVISOR_DATA.find(x => x.id === id);
        if (p) {
          setIntroFormProfile(p);
          setActiveMessageId(null);
        }
      } else if (hash.startsWith('message-')) {
        setActiveMessageId(hash.replace('message-', ''));
      } else if (hash.startsWith('profile-')) {
        const p = ADVISOR_DATA.find(x => x.id === hash);
        if (p) {
          setSelectedProfile(p);
          setIntroFormProfile(null);
          setActiveMessageId(null);
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
    if (activeMessageId) {
      expectedHash = `message-${activeMessageId}`;
    } else if (introFormProfile) {
      expectedHash = `intro-${introFormProfile.id}`;
    } else if (selectedProfile) {
      expectedHash = selectedProfile.id;
    }

    if (window.location.hash !== `#${expectedHash}`) {
      window.history.pushState(null, '', `#${expectedHash}`);
    }
  }, [activeTab, selectedProfile, introFormProfile, activeMessageId, user]);
  const allExpertise = useMemo(() => {
    // 1. Gather all unique expertise tags across the database
    const rawTags = new Set<string>();
    ADVISOR_DATA.forEach(p => p.expertise.forEach(e => {
      const tag = e.trim();
      if (tag) rawTags.add(tag);
    }));

    // 2. Score each tag based on how many profiles it matches IN TOTAL 
    //    (using our broadened search criteria: bio, role, company)
    const tagScores = Array.from(rawTags).map(tag => {
      const expLower = tag.toLowerCase();
      let matchCount = 0;

      ADVISOR_DATA.forEach(p => {
        const hasExactTag = p.expertise.some(e => e.toLowerCase() === expLower);
        const hasContextualMatch =
          p.bio.toLowerCase().includes(expLower) ||
          p.role.toLowerCase().includes(expLower) ||
          p.company.toLowerCase().includes(expLower);

        if (hasExactTag || hasContextualMatch) {
          matchCount++;
        }
      });

      return { tag, count: matchCount };
    });

    // 3. Filter for tags that yield at least 2 profiles, sort by match count (descending), 
    //    take top 15, then sort alphabetically for the UI display.
    const sortedTags = tagScores
      .filter(t => t.count >= 2)
      .sort((a, b) => b.count - a.count)
      .map(t => t.tag);

    // Explicitly guarantee 'CHRO' is always included per request
    const finalTags = new Set<string>();

    // Check if the dataset has CHRO, otherwise we just inject it exactly as 'CHRO'
    const chroTag = sortedTags.find(t => t.toLowerCase() === 'chro') || 'CHRO';
    finalTags.add(chroTag);

    for (const tag of sortedTags) {
      if (finalTags.size >= 15) break;
      finalTags.add(tag);
    }

    return Array.from(finalTags).sort();
  }, []);

  const filteredNetwork = useMemo(() => {
    let result = ADVISOR_DATA.filter(p => {
      // 1. General search bar text matching
      const matchesSearch = networkSearch === '' ||
        p.name.toLowerCase().includes(networkSearch.toLowerCase()) ||
        p.role.toLowerCase().includes(networkSearch.toLowerCase()) ||
        p.company.toLowerCase().includes(networkSearch.toLowerCase()) ||
        p.expertise.some(e => e.toLowerCase().includes(networkSearch.toLowerCase())) ||
        p.bio.toLowerCase().includes(networkSearch.toLowerCase()); // Also included bio in the general search

      // 2. Expertise tag filtering (Broadened to include past experience and role)
      let matchesExpertise = true;
      if (selectedExpertise) {
        const expLower = selectedExpertise.toLowerCase();

        // Exact tag match (Strongest signal)
        const hasExactTag = p.expertise.some(e => e.toLowerCase() === expLower);

        // Contextual matches (Past roles, bio, current role)
        const hasContextualMatch =
          p.bio.toLowerCase().includes(expLower) ||
          p.role.toLowerCase().includes(expLower) ||
          p.company.toLowerCase().includes(expLower);

        matchesExpertise = hasExactTag || hasContextualMatch;
      }

      return matchesSearch && matchesExpertise;
    });

    // 3. Sort Results if Expertise is selected
    // Since we broadened the filter, we want to ensure people with the ACTUAL
    // expertise tag appear at the top (1-3 profiles usually), followed by
    // people who just mentioned it in their bio/past roles.
    if (selectedExpertise) {
      const expLower = selectedExpertise.toLowerCase();
      result.sort((a, b) => {
        const aHasExact = a.expertise.some(e => e.toLowerCase() === expLower);
        const bHasExact = b.expertise.some(e => e.toLowerCase() === expLower);

        if (aHasExact && !bHasExact) return -1;
        if (!aHasExact && bHasExact) return 1;
        return 0; // If they both have it perfectly (or both just contextually), preserve order
      });
    }

    return result;
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
      if (introFormProfile) {
        const targetId = introFormProfile.id;
        const targetName = introFormProfile.name;
        setRequestedIntros(prev => new Set(prev).add(targetId));

        // Auto-accept request after 5 seconds
        setTimeout(() => {
          setAcceptedIntros(prev => {
            const next = new Set(prev);
            if (!next.has(targetId)) { // Prevent re-trigger if already accepted
              next.add(targetId);
              notify(`${targetName} has accepted your request, now you can message each other.`, targetId);
            }
            return next;
          });
        }, 5000);
      }
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
            { id: 'messages', label: 'Messages', icon: MessageCircle },
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

  const AdvisorCard = ({ profile, icon: Icon = ExternalLink, compact = false, showStatus = false }: { profile: Profile, icon?: any, compact?: boolean, showStatus?: boolean, key?: React.Key }) => {
    const isRequested = requestedIntros.has(profile.id);
    const isAccepted = acceptedIntros.has(profile.id);
    return (
      <motion.div
        layout
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
              <span className="text-sm font-medium truncate">{profile.role}</span>
            </div>
            <div className="text-xs font-bold text-sv-light-blue uppercase tracking-widest mt-1">{profile.company}</div>

            {isAccepted && (
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMessageId(profile.id); }}
                className="mt-3 text-xs font-bold text-green-600 flex items-center gap-1.5 hover:underline bg-green-50 px-3 py-1.5 rounded-lg w-fit transition-colors hover:bg-green-100"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Message Now
              </button>
            )}

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
        <ToastContainer />
      </div>
    );
  }

  if (activeMessageId) {
    const chatProfile = ADVISOR_DATA.find(p => p.id === activeMessageId)!;
    const chatLog = messages[activeMessageId] || [];

    const sendMessage = (e: React.FormEvent) => {
      e.preventDefault();
      const input = (e.target as any).messageInput.value;
      if (!input.trim()) return;

      const newMsg = { id: Date.now().toString(), sender: 'me' as const, text: input, timestamp: Date.now() };
      setMessages(prev => ({ ...prev, [activeMessageId]: [...(prev[activeMessageId] || []), newMsg] }));
      (e.target as any).messageInput.value = '';

      // Simulate reply 3 seconds later
      setTimeout(() => {
        const reply = { id: Date.now().toString(), sender: 'them' as const, text: `Thanks for reaching out! Let's arrange a time to chat about this.`, timestamp: Date.now() };
        setMessages(prev => ({ ...prev, [activeMessageId]: [...(prev[activeMessageId] || []), reply] }));
      }, 3000);
    };

    return (
      <div className="min-h-screen bg-sv-neutral-lightest text-sv-dark-blue font-sans">
        <Header />
        <main className="max-w-4xl mx-auto px-6 py-8 h-[calc(100vh-64px)] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
          <button onClick={() => setActiveMessageId(null)} className="mb-4 w-fit flex items-center gap-2 text-sm font-bold text-sv-neutral hover:text-sv-dark-blue group"><ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1" /> BACK</button>
          <div className="flex-1 bg-white rounded-3xl border border-sv-neutral-lighter shadow-xl overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-4 sm:p-6 border-b border-sv-neutral-lighter bg-sv-neutral-lightest flex items-center gap-4 cursor-pointer hover:bg-white transition-colors" onClick={() => setSelectedProfile(chatProfile)}>
              <img src={chatProfile.imageUrl} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" />
              <div><div className="font-bold text-xl">{chatProfile.name}</div><div className="text-sm font-medium text-sv-neutral-dark">{chatProfile.role} @ {chatProfile.company}</div></div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatLog.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-sv-neutral space-y-3 pb-10">
                  <div className="w-16 h-16 bg-sv-neutral-lightest rounded-full flex items-center justify-center"><MessageCircle className="w-8 h-8 text-sv-neutral-dark" /></div>
                  <div className="font-bold text-lg text-sv-dark-blue">Connected Request Accepted</div>
                  <p className="font-medium text-center">You can now direct message with {chatProfile.name}. Say hello!</p>
                </div>
              ) : (
                chatLog.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] font-medium leading-relaxed px-5 py-3 ${msg.sender === 'me' ? 'bg-sv-dark-blue text-white rounded-3xl rounded-br-sm shadow-md' : 'bg-sv-neutral-lightest border border-sv-neutral-lighter text-sv-dark-blue rounded-3xl rounded-bl-sm shadow-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={sendMessage} className="p-5 border-t border-sv-neutral-lighter bg-sv-neutral-lightest">
              <div className="max-w-3xl mx-auto flex gap-3 relative">
                <input type="text" name="messageInput" placeholder={`Message ${chatProfile.name}...`} className="flex-1 bg-white border border-sv-neutral-lighter rounded-full pl-6 pr-16 py-4 font-medium shadow-sm focus:outline-none focus:ring-4 focus:ring-sv-light-blue/20 focus:border-sv-light-blue transition-all" autoComplete="off" />
                <button type="submit" className="absolute right-2 top-2 bg-sv-dark-blue text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-sv-light-blue transition-all shadow-md"><Send className="w-4 h-4 ml-1" /></button>
              </div>
            </form>
          </div>
        </main>
        <ToastContainer />
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
                  {isAccepted ? (
                    <button onClick={() => setActiveMessageId(selectedProfile.id)} className="flex-1 sm:flex-none px-10 py-4 bg-green-500 text-white font-bold rounded-2xl shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2"><MessageCircle className="w-5 h-5" /> Message</button>
                  ) : (
                    <button onClick={() => !isRequested && setIntroFormProfile(selectedProfile)} disabled={isRequested} className={`flex-1 sm:flex-none px-8 py-4 rounded-2xl font-bold font-lg transition-all shadow-lg ${isRequested ? 'bg-sv-neutral-lightest text-sv-neutral-dark border border-sv-neutral-lighter' : 'bg-sv-dark-blue text-white hover:bg-sv-dark-blue/90'}`}>{isRequested ? "Request Pending" : "Request Intro"}</button>
                  )}
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
        <ToastContainer />
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
          {activeTab === 'messages' && (
            <motion.div key="messages" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-3xl mx-auto space-y-6">
              <h1 className="text-3xl font-bold flex items-center gap-3"><MessageCircle className="w-8 h-8 text-sv-light-blue" /> Direct Messages</h1>
              <div className="bg-white rounded-3xl shadow-lg border border-sv-neutral-lighter overflow-hidden">
                {Array.from(acceptedIntros).length === 0 ? (
                  <div className="p-12 text-center text-sv-neutral font-medium">No messages yet. When a founder accepts your request, the conversation will appear here!</div>
                ) : (
                  <div className="divide-y divide-sv-neutral-lighter">
                    {Array.from(acceptedIntros).map(id => {
                      const p = ADVISOR_DATA.find(x => x.id === id);
                      if (!p) return null;
                      const msgs = messages[id] || [];
                      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1].text : 'Connected! Tap to say hello.';
                      const lastTime = msgs.length > 0 ? new Date(msgs[msgs.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                      return (
                        <div key={id} onClick={() => setActiveMessageId(id)} className="p-4 sm:p-6 flex items-center gap-4 cursor-pointer hover:bg-sv-neutral-lightest transition-colors group">
                          <img src={p.imageUrl} className="w-14 h-14 rounded-full object-cover shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-bold text-lg text-sv-dark-blue truncate group-hover:text-sv-light-blue transition-colors">{p.name}</div>
                              {lastTime && <div className="text-xs font-bold text-sv-neutral uppercase tracking-widest">{lastTime}</div>}
                            </div>
                            <div className="text-sm text-sv-neutral-dark font-medium truncate">{lastMsg}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'graph' && <motion.div key="graph" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}><ConnectionGraph /></motion.div>}
        </AnimatePresence>

        <ToastContainer />
      </main>
    </div>
  );
}
