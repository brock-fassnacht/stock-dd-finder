import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { createBearVsBullPost, voteBearVsBull } from '../api'
import type { BearVsBullArgument } from '../api'
import { useAuth } from '../auth/AuthContext'
import { Loading } from '../components'
import { AuthButton } from '../components/AuthButton'
import { useBearVsBull, useCompanies } from '../hooks'

function sourceToneClass(sourceType: string) {
  switch (sourceType) {
    case 'reddit':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'x':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'seeking_alpha':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'community':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function prettySourceType(sourceType: string) {
  switch (sourceType) {
    case 'x':
      return 'X'
    case 'seeking_alpha':
      return 'Seeking Alpha'
    case 'community':
      return 'Community'
    default:
      return sourceType.charAt(0).toUpperCase() + sourceType.slice(1)
  }
}

function voteButtonClasses(direction: 'up' | 'down', disabled: boolean) {
  const base = 'rounded-full border px-2.5 py-1 text-[11px] font-medium transition'
  if (disabled) {
    return `${base} cursor-not-allowed border-white/10 bg-white/5 text-stone-500`
  }
  return direction === 'up'
    ? `${base} border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20`
    : `${base} border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20`
}

function ArgumentCard({
  argument,
  tone,
  onVote,
  votingKey,
}: {
  argument: BearVsBullArgument
  tone: 'bull' | 'bear'
  onVote: (direction: 'up' | 'down') => void
  votingKey: string | null
}) {
  const isVoting = votingKey === `${argument.entry_type}-${argument.id}`
  const borderTone = tone === 'bull' ? 'border-emerald-500/20' : 'border-rose-500/20'
  const linkTone = tone === 'bull' ? 'text-emerald-300 hover:text-emerald-200' : 'text-rose-300 hover:text-rose-200'

  return (
    <article className={`rounded-2xl border ${borderTone} bg-white/5 p-3 h-[180px] flex flex-col`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${sourceToneClass(argument.source_type)}`}>
            {prettySourceType(argument.source_type)}
          </span>
          {argument.is_user_generated && (
            <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
              Member post
            </span>
          )}
        </div>
        <span className="text-[11px] text-stone-400">
          {new Date(argument.as_of_date).toLocaleDateString()}
        </span>
      </div>

      <h4 className="text-base font-semibold text-white mb-1.5 leading-tight">{argument.title}</h4>

      <div className="mb-2 flex-1 overflow-y-auto pr-1">
        <p className="text-xs leading-5 text-stone-300 whitespace-pre-wrap">{argument.summary}</p>
      </div>

      <div className="mt-auto space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-stone-400 truncate max-w-[70%]">
            {argument.source_name}{argument.author_handle ? ` - ${argument.author_handle}` : ''}
          </span>
          {argument.url && (
            <a
              href={argument.url}
              target="_blank"
              rel="noopener noreferrer"
              className={linkTone}
            >
              Open source
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
          <div className="flex items-center gap-2 text-[11px] text-stone-400">
            <span>{argument.vote_score > 0 ? `+${argument.vote_score}` : argument.vote_score}</span>
            <span>{argument.upvotes} up</span>
            <span>{argument.downvotes} down</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={argument.has_voted || isVoting}
              onClick={() => onVote('up')}
              className={voteButtonClasses('up', argument.has_voted || isVoting)}
            >
              {isVoting ? '...' : 'Up'}
            </button>
            <button
              type="button"
              disabled={argument.has_voted || isVoting}
              onClick={() => onVote('down')}
              className={voteButtonClasses('down', argument.has_voted || isVoting)}
            >
              {isVoting ? '...' : 'Down'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function BearVsBullPage() {
  const { data: companies } = useCompanies()
  const { user, openAuthModal } = useAuth()
  const queryClient = useQueryClient()
  const [tickerFilter, setTickerFilter] = useState('')
  const [postStance, setPostStance] = useState<'bull' | 'bear'>('bull')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [postError, setPostError] = useState<string | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [votingKey, setVotingKey] = useState<string | null>(null)
  const [isComposerOpen, setIsComposerOpen] = useState(false)

  useEffect(() => {
    if (!tickerFilter && companies?.length) {
      setTickerFilter(companies[0].ticker)
    }
  }, [companies, tickerFilter])

  const { data, isLoading, error } = useBearVsBull({
    ticker: tickerFilter || undefined,
  })

  const bullCount = data?.bull_arguments.length ?? 0
  const bearCount = data?.bear_arguments.length ?? 0
  const communityCount = useMemo(() => {
    if (!data) return 0
    return [...data.bull_arguments, ...data.bear_arguments].filter(item => item.is_user_generated).length
  }, [data])

  const sourceList = useMemo(() => {
    const items = data ? [...data.bull_arguments, ...data.bear_arguments] : []
    return Array.from(new Set(items.map(item => prettySourceType(item.source_type))))
  }, [data])

  const remainingCharacters = 1700 - summary.length

  async function handleCreatePost(event: React.FormEvent) {
    event.preventDefault()
    if (!tickerFilter) return

    setPostError(null)
    setIsSubmitting(true)
    try {
      await createBearVsBullPost({
        ticker: tickerFilter,
        stance: postStance,
        title: title.trim(),
        summary: summary.trim(),
      })
      setTitle('')
      setSummary('')
      setIsComposerOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['bearVsBull'] })
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to publish post')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVote(argument: BearVsBullArgument, direction: 'up' | 'down') {
    setVoteError(null)
    const key = `${argument.entry_type}-${argument.id}`
    setVotingKey(key)
    try {
      await voteBearVsBull(argument.entry_type, argument.id, direction)
      await queryClient.invalidateQueries({ queryKey: ['bearVsBull'] })
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : 'Voting failed')
    } finally {
      setVotingKey(null)
    }
  }

  function toggleComposer() {
    setPostError(null)
    setIsComposerOpen(open => !open)
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col">
      <header className="border-b border-white/10 bg-stone-950/95 backdrop-blur px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1.5">
              <svg className="w-5 h-5 text-red-400" viewBox="0 0 64 64" fill="currentColor">
                <path d="M12 48c0-4 2-12 6-18l-8-14c-1-2 0-4 2-4h4l6 10c4-4 9-7 14-8V6c0-2 2-4 4-2l2 4v8c5 1 10 4 14 8l6-10h4c2 0 3 2 2 4l-8 14c4 6 6 14 6 18" />
                <path d="M20 44c-2-8 2-16 12-20M44 44c2-8-2-16-12-20" strokeWidth="2" stroke="currentColor" fill="none" />
                <circle cx="26" cy="32" r="2" />
                <circle cx="38" cy="32" r="2" />
              </svg>
              TickerClaw
            </Link>
            <span className="text-white/20">|</span>
            <h1 className="text-base sm:text-xl font-bold">Bear vs Bull</h1>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="text-sm text-stone-300" htmlFor="ticker-filter">
              Stock
            </label>
            <select
              id="ticker-filter"
              value={tickerFilter}
              onChange={e => setTickerFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white min-w-[180px]"
            >
              {companies?.map(company => (
                <option key={company.ticker} value={company.ticker} className="text-gray-900">
                  {company.ticker} - {company.name}
                </option>
              ))}
            </select>
            <AuthButton variant="dark" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-emerald-950/70 via-stone-900 to-rose-950/70 p-6 mb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400 mb-3">Argument Map</p>
              <h2 className="text-3xl sm:text-4xl font-semibold mb-3">
                {tickerFilter || 'Select a stock'} market debate
              </h2>
              <p className="text-stone-300 max-w-2xl">
                Compare bullish and bearish arguments side by side, add your own post with an account, and let visitors vote once on each take.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                <div className="text-stone-400">Bull arguments</div>
                <div className="text-2xl font-semibold text-emerald-300">{bullCount}</div>
              </div>
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3">
                <div className="text-stone-400">Bear arguments</div>
                <div className="text-2xl font-semibold text-rose-300">{bearCount}</div>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
                <div className="text-stone-400">Member posts</div>
                <div className="text-2xl font-semibold text-amber-200">{communityCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-stone-400">Sources tracked</div>
                <div className="text-lg font-semibold text-white">{sourceList.join(', ') || 'None yet'}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-stone-500">Community Posting</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Share your own bull or bear take</h3>
            </div>
            <button
              type="button"
              onClick={toggleComposer}
              className="rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
            >
              {isComposerOpen ? 'Close post form' : user ? 'Write a take' : 'Open post options'}
            </button>
          </div>

          {isComposerOpen && (
            <div className="mt-4 border-t border-white/10 pt-4">
              {user ? (
                <form className="space-y-4" onSubmit={handleCreatePost}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
                    <label className="text-sm text-stone-300">
                      Side
                      <select
                        value={postStance}
                        onChange={event => setPostStance(event.target.value as 'bull' | 'bear')}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                      >
                        <option value="bull" className="text-gray-900">Bull</option>
                        <option value="bear" className="text-gray-900">Bear</option>
                      </select>
                    </label>

                    <label className="text-sm text-stone-300">
                      Title
                      <input
                        type="text"
                        value={title}
                        onChange={event => setTitle(event.target.value)}
                        maxLength={120}
                        placeholder={`Example: Why ${tickerFilter || 'this stock'} still has upside`}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-amber-400"
                        required
                      />
                    </label>
                  </div>

                  <label className="block text-sm text-stone-300">
                    Your take
                    <textarea
                      value={summary}
                      onChange={event => setSummary(event.target.value)}
                      maxLength={1700}
                      rows={5}
                      placeholder="Make the case clearly and directly. Keep it under 1,700 characters."
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-amber-400"
                      required
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-stone-500">
                      {remainingCharacters} characters remaining. One account per email.
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting || remainingCharacters < 0 || !tickerFilter}
                      className="rounded-full bg-amber-300 px-5 py-2.5 text-sm font-medium text-stone-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? 'Publishing...' : `Post to ${postStance === 'bull' ? 'Bull' : 'Bear'} side`}
                    </button>
                  </div>

                  {postError && (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                      {postError}
                    </div>
                  )}
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-stone-400">
                  <span>Create an account to publish a bull or bear post. Voting stays available even without logging in.</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openAuthModal('register')}
                      className="rounded-full bg-amber-300 px-4 py-2 text-sm font-medium text-stone-950 hover:bg-amber-200"
                    >
                      Create account
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuthModal('login')}
                      className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/5"
                    >
                      Log in
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {voteError && (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {voteError}
          </div>
        )}

        {isLoading ? (
          <Loading />
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-5 text-rose-200">
            Failed to load bear vs bull arguments.
          </div>
        ) : (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
              <div className="border-b border-emerald-500/20 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/70 mb-2">Bull</p>
                <h3 className="text-2xl font-semibold text-emerald-200">Why investors are optimistic</h3>
              </div>
              <div className="p-5 space-y-3">
                {data?.bull_arguments.length ? data.bull_arguments.map(argument => (
                  <ArgumentCard
                    key={`${argument.entry_type}-${argument.id}`}
                    argument={argument}
                    tone="bull"
                    votingKey={votingKey}
                    onVote={direction => void handleVote(argument, direction)}
                  />
                )) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-stone-400">
                    No bullish arguments are stored for this ticker yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 overflow-hidden">
              <div className="border-b border-rose-500/20 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.3em] text-rose-300/70 mb-2">Bear</p>
                <h3 className="text-2xl font-semibold text-rose-200">What could go wrong</h3>
              </div>
              <div className="p-5 space-y-3">
                {data?.bear_arguments.length ? data.bear_arguments.map(argument => (
                  <ArgumentCard
                    key={`${argument.entry_type}-${argument.id}`}
                    argument={argument}
                    tone="bear"
                    votingKey={votingKey}
                    onVote={direction => void handleVote(argument, direction)}
                  />
                )) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-stone-400">
                    No bearish arguments are stored for this ticker yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-white/10 px-4 py-3 text-center text-xs text-stone-500">
        Community posts are user-submitted and votes are limited to one per post. Verify every claim before making investment decisions.
      </footer>
    </div>
  )
}
