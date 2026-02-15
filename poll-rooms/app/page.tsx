// app/page.tsx — Homepage: Grid & Emerald + Phase 6 Settings
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, X, Sparkles, Zap, Shield, Eye, Clock, CheckSquare } from 'lucide-react';

const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;

const DURATION_OPTIONS = [
  { label: 'No Limit', value: 0 },
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
];

export default function HomePage() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [resultsHidden, setResultsHidden] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [creating, setCreating] = useState(false);

  const addOption = () => {
    if (options.length < MAX_OPTIONS) setOptions([...options, '']);
  };
  const removeOption = (i: number) => {
    if (options.length > MIN_OPTIONS) setOptions(options.filter((_, idx) => idx !== i));
  };
  const updateOption = (i: number, v: string) => {
    const next = [...options];
    next[i] = v;
    setOptions(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) { toast.error('Question is required'); return; }
    const valid = options.map((o) => o.trim()).filter(Boolean);
    if (valid.length < MIN_OPTIONS) { toast.error(`Need at least ${MIN_OPTIONS} options`); return; }
    if (new Set(valid.map((o) => o.toLowerCase())).size !== valid.length) { toast.error('Remove duplicate options'); return; }

    setCreating(true);
    try {
      const res = await fetch('/api/polls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          options: valid,
          resultsHidden,
          durationMinutes: durationMinutes > 0 ? durationMinutes : undefined,
          allowMultiple,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Creation failed'); setCreating(false); return; }
      toast.success('Poll created!');
      router.push(`/p/${data.slug}`);
    } catch {
      toast.error('Network error — try again');
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 max-w-xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 mb-6">
            <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-live" />
            <span className="text-xs font-medium text-emerald-400 tracking-wide uppercase">Live Voting</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-100 leading-[1.1]">
            Real-Time Polls,
            <br />
            <span className="text-emerald-400">Instantly</span>.
          </h1>
          <p className="mt-4 text-base text-gray-400 leading-relaxed max-w-md mx-auto">
            Create a poll, share the link, watch votes stream in live.
          </p>
        </motion.div>

        {/* Form Card */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="glass-panel-strong p-6 sm:p-8 w-full max-w-lg space-y-6"
        >
          {/* Question */}
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-300 mb-2">
              Question
            </label>
            <input
              id="question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What should we decide?"
              maxLength={500}
              className="grid-input w-full px-4 py-3 text-base"
            />
            <div className="mt-1.5 text-right">
              <span className="text-xs text-neutral-600 tabular-nums">{question.length}/500</span>
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Options</label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2"
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-md bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[11px] text-neutral-500 font-mono tabular-nums">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    maxLength={200}
                    className="grid-input flex-1 px-4 py-2.5 text-sm"
                  />
                  {options.length > MIN_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="flex-shrink-0 rounded-md p-1.5 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                onClick={addOption}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-neutral-700 px-4 py-2 text-sm text-neutral-500 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Option
              </button>
            )}
            <p className="mt-1.5 text-xs text-neutral-600">{MIN_OPTIONS}–{MAX_OPTIONS} options</p>
          </div>

          {/* ── Poll Settings ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Settings</h3>

            {/* Timer */}
            <div className="glass-panel p-4">
              <label htmlFor="duration" className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    Timer
                  </span>
                  <p className="text-xs text-neutral-500 mt-0.5">Auto-close after duration</p>
                </div>
                <select
                  id="duration"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="grid-input px-3 py-1.5 text-sm rounded-lg min-w-[130px] text-right cursor-pointer"
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Multiple Choice */}
            <div className="glass-panel p-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                    <CheckSquare className="h-4 w-4 text-emerald-400" />
                    Multiple Choice
                  </span>
                  <p className="text-xs text-neutral-500 mt-0.5">Allow picking more than one</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowMultiple}
                  onClick={() => setAllowMultiple(!allowMultiple)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${allowMultiple ? 'bg-emerald-600' : 'bg-neutral-700'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${allowMultiple ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </label>
            </div>

            {/* Blind Voting */}
            <div className="glass-panel p-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                    <Eye className="h-4 w-4 text-emerald-400" />
                    Blind Voting
                  </span>
                  <p className="text-xs text-neutral-500 mt-0.5">Hide results until after voting</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={resultsHidden}
                  onClick={() => setResultsHidden(!resultsHidden)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${resultsHidden ? 'bg-emerald-600' : 'bg-neutral-700'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${resultsHidden ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:from-emerald-400 hover:to-green-500 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Create Poll
              </span>
            )}
          </button>

          {/* Feature strip */}
          <div className="pt-2 flex items-center justify-center gap-5 text-[11px] text-neutral-600 uppercase tracking-wider font-medium">
            <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Real-Time</span>
            <span className="text-neutral-800">·</span>
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Anti-Abuse</span>
            <span className="text-neutral-800">·</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Blind Mode</span>
          </div>
        </motion.form>
      </main>

      <footer className="pb-6 text-center text-xs text-neutral-700">
        Built with Next.js · Socket.io · Supabase
      </footer>
    </div>
  );
}
