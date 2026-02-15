// app/p/[slug]/page.tsx — Poll Room: Select → Submit Flow + Timer + Multi-Select
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { Share2, Copy, Check, ArrowLeft, Sparkles, Clock, CheckSquare } from 'lucide-react';
import { getDeviceFingerprint } from '@/lib/fingerprint';

// ─── Types ───────────────────────────────────────────────
interface Option { id: string; text: string; vote_count: number; display_order: number; }
interface Poll {
    id: string; slug: string; question: string; options: Option[]; totalVotes: number;
    resultsHidden?: boolean; expiresAt?: string | null; allowMultiple?: boolean; isActive?: boolean;
}

// ─── Confetti ────────────────────────────────────────────
function fireConfetti() {
    const colors = ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f472b6'];
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.65 }, colors, ticks: 80, gravity: 0.9 });
    setTimeout(() => confetti({ particleCount: 40, spread: 100, origin: { y: 0.6, x: 0.6 }, colors, ticks: 70 }), 150);
}

// ─── Component ───────────────────────────────────────────
export default function PollPage() {
    const params = useParams();
    const slug = params?.slug as string;

    const [poll, setPoll] = useState<Poll | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasVoted, setHasVoted] = useState(false);
    const [voting, setVoting] = useState(false);
    const [votedOptionIds, setVotedOptionIds] = useState<string[]>([]);
    const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
    const [socketConnected, setSocketConnected] = useState(false);
    const [copied, setCopied] = useState(false);
    const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
    const [canNativeShare, setCanNativeShare] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    const socketRef = useRef<Socket | null>(null);
    const fingerprintRef = useRef<string | null>(null);

    // ─── Mount ─────────────────────────────────────────────
    useEffect(() => {
        setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share);
        getDeviceFingerprint().then((fp) => { fingerprintRef.current = fp; });
    }, []);

    // ─── Rate limit countdown ──────────────────────────────
    useEffect(() => {
        if (rateLimitCountdown <= 0) return;
        const iv = setInterval(() => {
            setRateLimitCountdown((p) => { if (p <= 1) { clearInterval(iv); return 0; } return p - 1; });
        }, 1000);
        return () => clearInterval(iv);
    }, [rateLimitCountdown]);

    // ─── Expiry countdown ─────────────────────────────────
    useEffect(() => {
        if (!poll?.expiresAt) return;
        const updateTimeLeft = () => {
            const remaining = Math.max(0, Math.floor((new Date(poll.expiresAt!).getTime() - Date.now()) / 1000));
            setTimeLeft(remaining);
        };
        updateTimeLeft();
        const iv = setInterval(updateTimeLeft, 1000);
        return () => clearInterval(iv);
    }, [poll?.expiresAt]);

    const isExpired = timeLeft !== null && timeLeft <= 0;

    // ─── Fetch poll ────────────────────────────────────────
    useEffect(() => {
        if (!slug) return;
        (async () => {
            try {
                const res = await fetch(`/api/polls/${slug}`);
                if (!res.ok) { setError(res.status === 404 ? 'Poll not found' : 'Failed to load'); setLoading(false); return; }
                const data = await res.json();
                setPoll(data);
                setLoading(false);
                if (localStorage.getItem(`voted_${data.id}`)) {
                    setHasVoted(true);
                    const stored = localStorage.getItem(`voted_options_${data.id}`);
                    if (stored) {
                        try { setVotedOptionIds(JSON.parse(stored)); } catch { /* ignore */ }
                    }
                }
            } catch (err) { console.error(err); setError('Connection failed'); setLoading(false); }
        })();
    }, [slug]);

    // ─── Socket ────────────────────────────────────────────
    useEffect(() => {
        if (!poll) return;
        const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        const socket = io(url, { transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
        socketRef.current = socket;
        socket.on('connect', () => { setSocketConnected(true); socket.emit('join_poll', poll.id); });
        socket.on('disconnect', () => setSocketConnected(false));
        socket.on('reconnect', () => socket.emit('join_poll', poll.id));
        socket.on('vote_update', (d: { optionId: string; newCount: number }) => {
            setPoll((p) => {
                if (!p) return p;
                const opts = p.options.map((o) => o.id === d.optionId ? { ...o, vote_count: d.newCount } : o);
                return { ...p, options: opts, totalVotes: opts.reduce((s, o) => s + o.vote_count, 0) };
            });
        });
        return () => { socket.emit('leave_poll', poll.id); socket.disconnect(); };
    }, [poll?.id]);

    // ─── Toggle selection ──────────────────────────────────
    const toggleOption = useCallback((optionId: string) => {
        if (hasVoted || voting || rateLimitCountdown > 0 || isExpired) return;
        setSelectedOptions((prev) => {
            if (poll?.allowMultiple) {
                return prev.includes(optionId)
                    ? prev.filter((id) => id !== optionId)
                    : [...prev, optionId];
            }
            // Single mode: replace
            return prev[0] === optionId ? [] : [optionId];
        });
    }, [hasVoted, voting, rateLimitCountdown, isExpired, poll?.allowMultiple]);

    // ─── Submit ballot ────────────────────────────────────
    const handleSubmit = useCallback(async () => {
        if (!poll || hasVoted || voting || selectedOptions.length === 0 || rateLimitCountdown > 0 || isExpired) return;
        setVoting(true);

        // Optimistic update
        const prevOptions = [...poll.options];
        setPoll((p) => {
            if (!p) return p;
            const opts = p.options.map((o) =>
                selectedOptions.includes(o.id) ? { ...o, vote_count: o.vote_count + 1 } : o
            );
            return { ...p, options: opts, totalVotes: opts.reduce((s, o) => s + o.vote_count, 0) };
        });

        try {
            if (!fingerprintRef.current) fingerprintRef.current = await getDeviceFingerprint();
            const res = await fetch(`/api/polls/${slug}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ optionIds: selectedOptions, fingerprint: fingerprintRef.current }),
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem(`voted_${poll.id}`, 'true');
                localStorage.setItem(`voted_options_${poll.id}`, JSON.stringify(selectedOptions));
                setHasVoted(true);
                setVotedOptionIds(selectedOptions);
                // Apply server counts
                if (data.results) {
                    setPoll((p) => {
                        if (!p) return p;
                        const opts = p.options.map((o) =>
                            data.results[o.id] !== undefined ? { ...o, vote_count: data.results[o.id] } : o
                        );
                        return { ...p, options: opts, totalVotes: opts.reduce((s, o) => s + o.vote_count, 0) };
                    });
                }
                fireConfetti();
                toast.success('Vote recorded!', { description: 'Results update live.' });
            } else {
                setPoll((p) => p ? { ...p, options: prevOptions, totalVotes: prevOptions.reduce((s, o) => s + o.vote_count, 0) } : p);
                if (res.status === 409) { localStorage.setItem(`voted_${poll.id}`, 'true'); setHasVoted(true); toast.warning('Already voted'); }
                else if (res.status === 429) { setRateLimitCountdown(data.retryAfter || 600); toast.error('Rate limited', { description: `Wait ${fmt(data.retryAfter || 600)}` }); }
                else if (res.status === 403) toast.error(data.error || 'Poll closed');
                else toast.error(data.error || 'Vote failed');
            }
        } catch {
            setPoll((p) => p ? { ...p, options: prevOptions, totalVotes: prevOptions.reduce((s, o) => s + o.vote_count, 0) } : p);
            toast.error('Network error');
        } finally {
            setVoting(false);
        }
    }, [poll, hasVoted, voting, selectedOptions, slug, rateLimitCountdown, isExpired]);

    // ─── Share ─────────────────────────────────────────────
    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try { await navigator.share({ title: poll?.question || 'Poll', url }); return; }
            catch (e) { if ((e as Error).name === 'AbortError') return; }
        }
        try { await navigator.clipboard.writeText(url); }
        catch { const i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select(); document.execCommand('copy'); document.body.removeChild(i); }
        setCopied(true);
        toast.success('Link copied!');
        setTimeout(() => setCopied(false), 2000);
    };

    // ─── Loading ───────────────────────────────────────────
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-neutral-800 border-t-emerald-500" />
                <p className="mt-4 text-sm text-neutral-500">Loading poll…</p>
            </motion.div>
        </div>
    );

    // ─── Error ─────────────────────────────────────────────
    if (error || !poll) return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel p-8 text-center max-w-md">
                <div className="text-4xl mb-4">😕</div>
                <h2 className="text-xl font-bold text-gray-100">{error === 'Poll not found' ? 'Poll Not Found' : 'Oops!'}</h2>
                <p className="mt-2 text-neutral-500 text-sm">{error || 'Something went wrong'}</p>
                <a href="/" className="mt-6 inline-block rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors">
                    Create a New Poll
                </a>
            </motion.div>
        </div>
    );

    // ─── Computed ──────────────────────────────────────────
    const totalVotes = poll.options.reduce((s, o) => s + o.vote_count, 0);
    const showResults = hasVoted || !poll.resultsHidden;
    const maxVotes = Math.max(...poll.options.map((o) => o.vote_count), 1);
    const leaderId = poll.options.reduce((best, o) => o.vote_count > best.vote_count ? o : best, poll.options[0])?.id;
    const hasClearWinner = totalVotes >= 3 && poll.options.filter((o) => o.vote_count === maxVotes).length === 1;
    const canVote = !hasVoted && !isExpired && rateLimitCountdown <= 0;

    return (
        <div className="min-h-screen flex flex-col justify-center">
            {/* ── Nav ── */}
            <nav className="flex items-center justify-between px-4 py-4 max-w-2xl mx-auto w-full">
                <a href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-emerald-400 transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    <span>New Poll</span>
                </a>
                <div className="flex items-center gap-3">
                    {/* Timer badge */}
                    {timeLeft !== null && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-mono font-bold ${isExpired
                                ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                : timeLeft <= 60
                                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            }`}>
                            <Clock className="h-3 w-3" />
                            {isExpired ? 'Expired' : fmtTimer(timeLeft)}
                        </span>
                    )}
                    {/* Live indicator */}
                    <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${socketConnected ? 'bg-emerald-500 pulse-live' : 'bg-neutral-700'}`} />
                        <span className="text-xs font-medium text-neutral-500">{socketConnected ? 'Live' : '…'}</span>
                    </div>
                </div>
            </nav>

            <main className="flex-1 flex flex-col justify-center max-w-2xl mx-auto px-4 pb-12 w-full">
                {/* ── Question card ── */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="glass-panel-strong p-6 sm:p-8 mb-6"
                >
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 tracking-tight leading-tight">
                        {poll.question}
                    </h1>
                    <div className="mt-3 flex items-center gap-3 text-sm flex-wrap">
                        {showResults ? (
                            <span className="font-medium text-neutral-400 tabular-nums">
                                {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
                                <Sparkles className="h-3 w-3" />
                                Vote to reveal results
                            </span>
                        )}
                        {poll.allowMultiple && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400">
                                <CheckSquare className="h-3 w-3" />
                                Select multiple
                            </span>
                        )}
                        {rateLimitCountdown > 0 && (
                            <span className="text-amber-400 text-xs font-mono">⏱ {fmt(rateLimitCountdown)}</span>
                        )}
                    </div>
                </motion.div>

                {/* ── Options (select, don't vote) ── */}
                <div className="space-y-3">
                    {poll.options
                        .sort((a, b) => a.display_order - b.display_order)
                        .map((option, index) => {
                            const pct = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
                            const barPct = showResults && totalVotes > 0 ? (option.vote_count / maxVotes) * 100 : 0;
                            const isSelected = selectedOptions.includes(option.id);
                            const isMyVote = votedOptionIds.includes(option.id);
                            const isWinner = showResults && hasClearWinner && option.id === leaderId;
                            const isDisabled = !canVote || voting;

                            return (
                                <motion.button
                                    key={option.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.08 + index * 0.05, duration: 0.3 }}
                                    onClick={() => toggleOption(option.id)}
                                    disabled={isDisabled && !hasVoted}
                                    className={`group relative w-full text-left rounded-xl p-5 transition-all
                    ${isMyVote
                                            ? 'glass-panel-strong ring-1 ring-emerald-500/50'
                                            : isSelected
                                                ? 'glass-panel-strong ring-1 ring-emerald-500/40 bg-emerald-500/5'
                                                : isWinner
                                                    ? 'glass-panel winner-glow'
                                                    : 'glass-panel'
                                        }
                    ${canVote && !voting
                                            ? 'hover:bg-neutral-800/60 cursor-pointer active:scale-[0.99]'
                                            : hasVoted
                                                ? 'cursor-default'
                                                : 'cursor-not-allowed opacity-60'
                                        }
                  `}
                                >
                                    {/* Vote bar */}
                                    {showResults && (
                                        <div className="absolute inset-x-3 bottom-2 h-1.5 vote-bar-track">
                                            <motion.div
                                                className={`h-full vote-bar-fill vote-bar-stripes ${isMyVote || isWinner ? 'vote-bar-fill-winner' : ''}`}
                                                initial={{ width: '0%' }}
                                                animate={{ width: `${barPct}%` }}
                                                transition={{ type: 'spring', stiffness: 100, damping: 20, mass: 0.8 }}
                                            />
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="relative flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {/* Selection indicator (before voting) */}
                                            {!hasVoted && (
                                                <span className={`flex-shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected
                                                        ? 'border-emerald-500 bg-emerald-500'
                                                        : 'border-neutral-600'
                                                    }`}>
                                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                                </span>
                                            )}
                                            {/* Voted checkmark */}
                                            {hasVoted && isMyVote && (
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: 'spring', stiffness: 250 }}
                                                    className="flex-shrink-0"
                                                >
                                                    <Check className="h-5 w-5 text-emerald-400" />
                                                </motion.span>
                                            )}
                                            {isWinner && !isMyVote && hasVoted && <span className="text-sm">🏆</span>}
                                            <span className={`text-base font-medium ${isMyVote ? 'text-emerald-300'
                                                    : isSelected ? 'text-emerald-200'
                                                        : 'text-gray-200'
                                                }`}>
                                                {option.text}
                                            </span>
                                        </div>
                                        {showResults ? (
                                            <motion.div
                                                initial={{ opacity: 0, x: 8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.3 }}
                                                className="flex items-center gap-2 text-sm"
                                            >
                                                <span className={`font-bold tabular-nums ${isWinner ? 'text-emerald-400' : 'text-gray-200'}`}>
                                                    {option.vote_count}
                                                </span>
                                                <span className="text-neutral-600 tabular-nums text-xs">{pct}%</span>
                                            </motion.div>
                                        ) : (
                                            !hasVoted && <span className="text-xs text-neutral-600 italic">
                                                {isSelected ? 'Selected' : 'Tap to select'}
                                            </span>
                                        )}
                                    </div>
                                </motion.button>
                            );
                        })}
                </div>

                {/* ── Submit Button ── */}
                <AnimatePresence>
                    {!hasVoted && !isExpired && (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 12 }}
                            transition={{ duration: 0.3 }}
                            className="mt-6"
                        >
                            <button
                                onClick={handleSubmit}
                                disabled={selectedOptions.length === 0 || voting || rateLimitCountdown > 0}
                                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:from-emerald-400 hover:to-green-500 transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-emerald-500/20"
                            >
                                {voting ? (
                                    <span className="inline-flex items-center gap-2 justify-center">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Submitting…
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-2 justify-center">
                                        <Sparkles className="h-4 w-4" />
                                        Submit Vote{selectedOptions.length > 1 ? `s (${selectedOptions.length})` : ''}
                                    </span>
                                )}
                            </button>
                            {selectedOptions.length === 0 && (
                                <p className="mt-2 text-center text-xs text-neutral-600">
                                    Select {poll.allowMultiple ? 'one or more options' : 'an option'} above
                                </p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Banners ── */}
                <AnimatePresence>
                    {hasVoted && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 glass-panel p-4 text-center">
                            <p className="text-sm font-medium text-emerald-400">✓ Vote recorded — results are live</p>
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {isExpired && !hasVoted && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 glass-panel p-4 text-center border-red-500/20">
                            <p className="text-sm font-medium text-red-400">⏱ This poll has expired</p>
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {rateLimitCountdown > 0 && !hasVoted && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 glass-panel p-4 border-amber-500/20">
                            <p className="text-sm text-amber-400">⚠️ Rate limited — try in <span className="font-mono font-bold">{fmt(rateLimitCountdown)}</span></p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Share ── */}
                <div className="mt-8 flex flex-col items-center gap-3">
                    <button
                        onClick={handleShare}
                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-800 bg-transparent px-6 py-3 text-sm font-medium text-neutral-400 hover:border-emerald-500/30 hover:text-emerald-400 transition-all active:scale-[0.98]"
                    >
                        {copied ? (
                            <><Check className="h-4 w-4 text-emerald-400" /> Copied!</>
                        ) : (
                            <>{canNativeShare ? <Share2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Share Poll</>
                        )}
                    </button>
                    <a href="/" className="text-xs text-neutral-600 hover:text-emerald-400 transition-colors">
                        ← Create another poll
                    </a>
                </div>
            </main>
        </div>
    );
}

// ─── Helpers ─────────────────────────────────────────────
function fmt(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
function fmtTimer(s: number) {
    if (s >= 3600) {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
