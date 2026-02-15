// app/p/[slug]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';

interface Option {
  id: string;
  text: string;
  vote_count: number;
  display_order: number;
}

interface Poll {
  id: string;
  question: string;
  options: Option[];
  totalVotes: number;
}

// Device fingerprinting utility
async function getDeviceFingerprint(): Promise<string> {
  // Simple fingerprint using browser properties
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
  }
  const canvasData = canvas.toDataURL();
  
  const fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvasHash: canvasData.slice(0, 50), // First 50 chars of canvas data
  };

  // Simple hash function
  const str = JSON.stringify(fingerprint);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

export default function PollPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const fingerprintRef = useRef<string | null>(null);

  // Fetch poll data
  useEffect(() => {
    async function fetchPoll() {
      try {
        const response = await fetch(`/api/polls/${slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Poll not found');
          } else {
            setError('Failed to load poll');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setPoll(data);
        setLoading(false);

        // Check if already voted (localStorage)
        const votedKey = `voted_${data.id}`;
        if (localStorage.getItem(votedKey)) {
          setHasVoted(true);
        }
      } catch (err) {
        console.error('Error fetching poll:', err);
        setError('Failed to load poll');
        setLoading(false);
      }
    }

    fetchPoll();
  }, [slug]);

  // Socket.io connection
  useEffect(() => {
    if (!poll) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    socketRef.current = io(socketUrl);

    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      socketRef.current!.emit('join_poll', poll.id);
    });

    socketRef.current.on('vote_update', (data: { optionId: string; newCount: number }) => {
      setPoll(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          options: prev.options.map(opt =>
            opt.id === data.optionId
              ? { ...opt, vote_count: data.newCount }
              : opt
          ),
          totalVotes: prev.options.reduce((sum, opt) => 
            sum + (opt.id === data.optionId ? data.newCount : opt.vote_count), 0
          ),
        };
      });
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_poll', poll.id);
        socketRef.current.disconnect();
      }
    };
  }, [poll?.id]);

  // Handle vote
  const handleVote = async (optionId: string) => {
    if (hasVoted) {
      alert('You have already voted on this poll');
      return;
    }

    setVoting(true);
    setSelectedOption(optionId);

    try {
      // Get or generate fingerprint
      if (!fingerprintRef.current) {
        fingerprintRef.current = await getDeviceFingerprint();
      }

      const response = await fetch(`/api/polls/${slug}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionId,
          fingerprint: fingerprintRef.current,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Mark as voted in localStorage
        localStorage.setItem(`voted_${poll!.id}`, 'true');
        setHasVoted(true);
        
        // Optimistically update UI (socket will also update)
        setPoll(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            options: prev.options.map(opt =>
              opt.id === optionId
                ? { ...opt, vote_count: data.newCount }
                : opt
            ),
          };
        });
      } else {
        // Handle errors
        if (response.status === 409) {
          setHasVoted(true);
          localStorage.setItem(`voted_${poll!.id}`, 'true');
        }
        alert(data.error || 'Failed to submit vote');
      }
    } catch (err) {
      console.error('Vote error:', err);
      alert('Failed to submit vote. Please try again.');
    } finally {
      setVoting(false);
      setSelectedOption(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading poll...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !poll) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-4">{error || 'Poll not found'}</p>
          <a href="/" className="text-blue-500 hover:underline">
            Create a new poll
          </a>
        </div>
      </div>
    );
  }

  // Calculate percentages
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.vote_count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Poll Question */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {poll.question}
          </h1>
          <p className="text-gray-500">
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-4">
          {poll.options
            .sort((a, b) => a.display_order - b.display_order)
            .map((option) => {
              const percentage = totalVotes > 0 
                ? Math.round((option.vote_count / totalVotes) * 100) 
                : 0;

              return (
                <button
                  key={option.id}
                  onClick={() => !hasVoted && handleVote(option.id)}
                  disabled={hasVoted || voting}
                  className={`
                    w-full bg-white rounded-lg shadow-md p-6 transition-all
                    ${hasVoted ? 'cursor-default' : 'hover:shadow-xl hover:scale-102 cursor-pointer'}
                    ${selectedOption === option.id ? 'opacity-50' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-semibold text-gray-800">
                      {option.text}
                    </span>
                    <span className="text-sm font-medium text-gray-600">
                      {option.vote_count} ({percentage}%)
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 ease-out"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </button>
              );
            })}
        </div>

        {/* Status message */}
        {hasVoted && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-700 font-medium">
              ✓ Your vote has been recorded. Results update in real-time!
            </p>
          </div>
        )}

        {/* Share button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Link copied to clipboard!');
            }}
            className="inline-flex items-center px-6 py-3 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Poll
          </button>
        </div>
      </div>
    </div>
  );
}
