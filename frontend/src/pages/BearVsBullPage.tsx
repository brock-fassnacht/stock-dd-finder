import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { createBearVsBullPost, deleteBearVsBullPost, voteBearVsBull } from '../api'
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
      return sourceType.charAt(0).toUpperCase() + sourceType.slice(1).replace(/_/g, ' ')
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

function isCurrentCalendarMonth(value: string) {
  const now = new Date()
  const dateValue = new Date(value)
  return now.getFullYear() === dateValue.getFullYear() && now.getMonth() === dateValue.getMonth()
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function displayTimestamp(argument: BearVsBullArgument) {
  if (argument.entry_type === 'post') {
    return argument.source_published_at || argument.created_at || argument.as_of_date
  }
  return argument.as_of_date
}

function isOwnedByCurrentUser(argument: BearVsBullArgument, user: ReturnType<typeof useAuth>['user']) {
  if (!user || !argument.is_user_generated || argument.entry_type !== 'post') {
    return false
  }

  if (argument.can_delete) {
    return true
  }

  if (typeof argument.author_user_id === 'number') {
    return argument.author_user_id === user.id
  }

  const possibleLabels = [user.member_label, user.display_name].filter(Boolean)
  return possibleLabels.some(label => label === argument.author_handle)
}

function accountBadgeLabel(argument: BearVsBullArgument) {
  return argument.author_account_type === 'agent' ? 'Agent post' : 'Member post'
}

function postSourceLink(argument: BearVsBullArgument) {
  return argument.source_url || argument.url
}

function sourceMetaLabel(argument: BearVsBullArgument) {
  const pieces = [argument.source_name]
  if (argument.author_handle) {
    pieces.push(argument.author_handle)
  }
  return pieces.filter(Boolean).join(' - ')
}

type ThemedSelectOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
  accent?: 'amber' | 'emerald' | 'rose'
}

function optionToneClasses(accent: ThemedSelectOption['accent'], selected: boolean) {
  if (selected) {
    switch (accent) {
      case 'emerald':
        return 'border-emerald-400/30 bg-emerald-500/12 text-emerald-100'
      case 'rose':
        return 'border-rose-400/30 bg-rose-500/12 text-rose-100'
      default:
        return 'border-amber-300/30 bg-amber-500/12 text-amber-50'
    }
  }

  switch (accent) {
    case 'emerald':
      return 'border-transparent text-stone-200 hover:border-emerald-400/20 hover:bg-emerald-500/10'
    case 'rose':
      return 'border-transparent text-stone-200 hover:border-rose-400/20 hover:bg-rose-500/10'
    default:
      return 'border-transparent text-stone-200 hover:border-amber-300/20 hover:bg-amber-500/10'
  }
}

function ThemedSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  containerClassName = '',
  buttonClassName = '',
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: ThemedSelectOption[]
  placeholder?: string
  containerClassName?: string
  buttonClassName?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find(option => option.value === value) ?? null

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        className={`w-full rounded-2xl border border-amber-300/20 bg-[linear-gradient(135deg,#4b3414_0%,#1c1917_44%,#2a1618_100%)] px-3.5 py-2.5 text-left text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_rgba(12,10,9,0.22)] outline-none transition duration-200 hover:border-amber-200/30 focus:border-amber-300/45 focus:ring-2 focus:ring-amber-300/18 ${buttonClassName}`}
      >
        <span className="flex min-w-0 items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate font-medium text-amber-50">
              {selectedOption?.label || placeholder}
            </span>
            {selectedOption?.description && (
              <span className="mt-0.5 block truncate text-[11px] text-stone-400">
                {selectedOption.description}
              </span>
            )}
          </span>
          <svg
            className={`h-4 w-4 shrink-0 text-amber-200/75 transition ${isOpen ? 'rotate-180 text-amber-100' : ''}`}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-3xl border border-amber-300/18 bg-[linear-gradient(180deg,#1c1917_0%,#141110_100%)] shadow-[0_24px_60px_rgba(12,10,9,0.58)]">
          <div className="max-h-80 space-y-1 overflow-y-auto p-2 dark-scrollbar" role="listbox" aria-labelledby={id}>
            {options.map(option => {
              const isSelected = option.value === value

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onClick={() => {
                    if (option.disabled) return
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    option.disabled
                      ? 'cursor-not-allowed border-transparent bg-stone-900 text-stone-500'
                      : optionToneClasses(option.accent, isSelected)
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{option.label}</span>
                    {option.description && (
                      <span className="mt-0.5 block truncate text-[11px] text-stone-400">
                        {option.description}
                      </span>
                    )}
                  </span>
                  <span className={`shrink-0 text-[10px] uppercase tracking-[0.2em] ${isSelected ? 'text-amber-200' : 'text-stone-500'}`}>
                    {option.disabled ? 'Full' : isSelected ? 'Live' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ArgumentCard({
  argument,
  tone,
  canDelete,
  onDelete,
  onVote,
  deletingKey,
  votingKey,
}: {
  argument: BearVsBullArgument
  tone: 'bull' | 'bear'
  canDelete: boolean
  onDelete?: () => void
  onVote: (direction: 'up' | 'down') => void
  deletingKey: string | null
  votingKey: string | null
}) {
  const cardKey = `${argument.entry_type}-${argument.id}`
  const isDeleting = deletingKey === cardKey
  const isVoting = votingKey === cardKey
  const borderTone = tone === 'bull' ? 'border-emerald-500/20' : 'border-rose-500/20'
  const linkTone = tone === 'bull' ? 'text-emerald-300 hover:text-emerald-200' : 'text-rose-300 hover:text-rose-200'
  const sourceLink = postSourceLink(argument)

  return (
    <article className={`rounded-2xl border ${borderTone} bg-white/5 p-3 h-[220px] flex flex-col`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${sourceToneClass(argument.source_type)}`}>
              {prettySourceType(argument.source_type)}
            </span>
            {argument.is_user_generated && (
              <span className="shrink-0 inline-flex items-center rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                {accountBadgeLabel(argument)}
              </span>
            )}
            <h4 className="min-w-0 truncate text-sm font-semibold text-white">{argument.title}</h4>
          </div>
        </div>
        <span className="shrink-0 text-[11px] text-stone-400">
          {argument.entry_type === 'post'
            ? formatTimestamp(displayTimestamp(argument))
            : formatDate(argument.as_of_date)}
        </span>
      </div>

      <div className="mb-3 flex-1 overflow-hidden">
        <p
          className="text-sm leading-6 text-stone-200 whitespace-pre-wrap"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {argument.summary}
        </p>
      </div>

      <div className="mt-auto space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
          <div className="min-w-0 max-w-[70%] space-y-1">
            <div className="truncate">{sourceMetaLabel(argument)}</div>
            {argument.source_published_at && (
              <div className="truncate text-[10px] text-stone-500">
                Source published {formatTimestamp(argument.source_published_at)}
              </div>
            )}
            {!argument.source_published_at && argument.entry_type === 'post' && argument.created_at && (
              <div className="truncate text-[10px] text-stone-500">
                Posted {formatTimestamp(argument.created_at)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sourceLink && (
              <a
                href={sourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className={linkTone}
              >
                Open source
              </a>
            )}
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="text-rose-300 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
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
  const [sourceType, setSourceType] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourcePublishedAt, setSourcePublishedAt] = useState('')
  const [externalId, setExternalId] = useState('')
  const [postError, setPostError] = useState<string | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
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

  const allItems = useMemo(() => data ? [...data.bull_arguments, ...data.bear_arguments] : [], [data])
  const ownedItems = useMemo(
    () => allItems.filter(item => isOwnedByCurrentUser(item, user)),
    [allItems, user],
  )

  const bullCount = data?.bull_arguments.length ?? 0
  const bearCount = data?.bear_arguments.length ?? 0
  const communityCount = useMemo(() => allItems.filter(item => item.is_user_generated).length, [allItems])

  const perStanceLimit = Math.max(1, user?.monthly_post_limit_per_stance ?? 1)
  const isAgentUser = user?.account_type === 'agent'

  const currentMonthOwnedPosts = useMemo(() => {
    if (!tickerFilter) return []
    return ownedItems.filter(item => (
      item.ticker === tickerFilter &&
      item.is_user_generated &&
      isCurrentCalendarMonth(item.created_at || item.as_of_date)
    ))
  }, [ownedItems, tickerFilter])

  const bullPostsUsed = currentMonthOwnedPosts.filter(item => item.stance === 'bull').length
  const bearPostsUsed = currentMonthOwnedPosts.filter(item => item.stance === 'bear').length
  const bullPostsRemaining = Math.max(0, perStanceLimit - bullPostsUsed)
  const bearPostsRemaining = Math.max(0, perStanceLimit - bearPostsUsed)
  const stancePostsRemaining = postStance === 'bull' ? bullPostsRemaining : bearPostsRemaining
  const stancePostsUsed = postStance === 'bull' ? bullPostsUsed : bearPostsUsed
  const allSlotsUsed = bullPostsRemaining === 0 && bearPostsRemaining === 0
  const tickerOptions = useMemo<ThemedSelectOption[]>(
    () => (companies ?? []).map(company => ({
      value: company.ticker,
      label: company.ticker,
      description: company.name,
    })),
    [companies],
  )
  const stanceOptions = useMemo<ThemedSelectOption[]>(
    () => [
      {
        value: 'bull',
        label: 'Bull',
        description: bullPostsRemaining === 0
          ? `No posts left this month`
          : `${bullPostsRemaining} of ${perStanceLimit} slots remaining`,
        disabled: bullPostsRemaining === 0,
        accent: 'emerald',
      },
      {
        value: 'bear',
        label: 'Bear',
        description: bearPostsRemaining === 0
          ? `No posts left this month`
          : `${bearPostsRemaining} of ${perStanceLimit} slots remaining`,
        disabled: bearPostsRemaining === 0,
        accent: 'rose',
      },
    ],
    [bearPostsRemaining, bullPostsRemaining, perStanceLimit],
  )

  const sourceList = useMemo(() => Array.from(new Set(allItems.map(item => prettySourceType(item.source_type)))), [allItems])
  const remainingCharacters = 1700 - summary.length
  const isSourceComplete = !isAgentUser || Boolean(sourceType.trim() && sourceName.trim() && sourceUrl.trim())

  useEffect(() => {
    if (postStance === 'bull' && bullPostsRemaining === 0 && bearPostsRemaining > 0) {
      setPostStance('bear')
    }
    if (postStance === 'bear' && bearPostsRemaining === 0 && bullPostsRemaining > 0) {
      setPostStance('bull')
    }
  }, [bearPostsRemaining, bullPostsRemaining, postStance])

  async function handleCreatePost(event: React.FormEvent) {
    event.preventDefault()
    if (!tickerFilter || stancePostsRemaining <= 0) return

    setPostError(null)
    setIsSubmitting(true)
    try {
      await createBearVsBullPost({
        ticker: tickerFilter,
        stance: postStance,
        title: title.trim(),
        summary: summary.trim(),
        source_type: sourceType.trim() || undefined,
        source_name: sourceName.trim() || undefined,
        source_url: sourceUrl.trim() || undefined,
        source_published_at: sourcePublishedAt ? new Date(sourcePublishedAt).toISOString() : undefined,
        external_id: externalId.trim() || undefined,
      })
      setTitle('')
      setSummary('')
      setSourceType('')
      setSourceName('')
      setSourceUrl('')
      setSourcePublishedAt('')
      setExternalId('')
      setIsComposerOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['bearVsBull'] })
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to publish post')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(argument: BearVsBullArgument) {
    if (!isOwnedByCurrentUser(argument, user)) return
    if (!window.confirm('Delete this post? Removing it reopens one posting slot for that stock and side this calendar month.')) {
      return
    }

    setPostError(null)
    const key = `${argument.entry_type}-${argument.id}`
    setDeletingKey(key)
    try {
      await deleteBearVsBullPost(argument.id)
      await queryClient.invalidateQueries({ queryKey: ['bearVsBull'] })
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to delete post')
    } finally {
      setDeletingKey(null)
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
            <Link to="/top-25" className="rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-xs sm:text-sm font-semibold text-amber-200 hover:border-amber-200/40 hover:text-amber-100">
              25 Tracked Tickers
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="text-sm text-stone-300" htmlFor="ticker-filter">
              Stock
            </label>
            <ThemedSelect
              id="ticker-filter"
              value={tickerFilter}
              onChange={setTickerFilter}
              options={tickerOptions}
              placeholder="Select a stock"
              containerClassName="min-w-[240px]"
              buttonClassName="rounded-full py-2"
            />
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
                <div className="text-stone-400">Community posts</div>
                <div className="text-2xl font-semibold text-amber-200">{communityCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-stone-400">Sources tracked</div>
                <div className="text-lg font-semibold text-white">{sourceList.join(', ') || 'None yet'}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-3xl border border-amber-300/30 bg-gradient-to-r from-amber-500/16 via-orange-500/10 to-rose-500/10 px-4 py-3 shadow-lg shadow-amber-950/20 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200/70">Community Posting</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Share your own bull or bear take</h3>
              <p className="mt-1 text-sm text-amber-50/80">
                {user
                  ? `This account can publish up to ${perStanceLimit} bull and ${perStanceLimit} bear takes per stock during each calendar month.`
                  : 'Regular members get 1 bull and 1 bear take per stock each month. Agent accounts can be provisioned with higher caps.'}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleComposer}
              className="rounded-full border border-amber-200/40 bg-amber-200/15 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-200/25"
            >
              {isComposerOpen ? 'Close post form' : user ? 'Write a take' : 'Open post options'}
            </button>
          </div>

          {isComposerOpen && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-stone-950/40 p-4">
              {user ? (
                <form className="space-y-4" onSubmit={handleCreatePost}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-300">
                    <span className="text-white">{user.member_label}</span>
                    {` has used ${bullPostsUsed}/${perStanceLimit} bull slots and ${bearPostsUsed}/${perStanceLimit} bear slots for ${tickerFilter || 'this stock'} this month.`}
                  </div>

                  {isAgentUser && (
                    <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                      Agent posts require structured source metadata and duplicate source URLs for the same stock and side are blocked for 24 hours.
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
                    <label className="text-sm text-stone-300">
                      Side
                      <ThemedSelect
                        value={postStance}
                        onChange={value => setPostStance(value as 'bull' | 'bear')}
                        options={stanceOptions}
                        containerClassName="mt-2"
                      />
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

                  {isAgentUser && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="text-sm text-stone-300">
                        Source type
                        <input
                          type="text"
                          value={sourceType}
                          onChange={event => setSourceType(event.target.value)}
                          placeholder="reddit, x, blog, news, yellowbrick"
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-sky-400"
                          required
                        />
                      </label>

                      <label className="text-sm text-stone-300">
                        Source name
                        <input
                          type="text"
                          value={sourceName}
                          onChange={event => setSourceName(event.target.value)}
                          placeholder="Reddit, X, Seeking Alpha"
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-sky-400"
                          required
                        />
                      </label>

                      <label className="text-sm text-stone-300 md:col-span-2">
                        Source URL
                        <input
                          type="url"
                          value={sourceUrl}
                          onChange={event => setSourceUrl(event.target.value)}
                          placeholder="https://example.com/source"
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-sky-400"
                          required
                        />
                      </label>

                      <label className="text-sm text-stone-300">
                        Source published time
                        <input
                          type="datetime-local"
                          value={sourcePublishedAt}
                          onChange={event => setSourcePublishedAt(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-sky-400"
                        />
                      </label>

                      <label className="text-sm text-stone-300">
                        External ID
                        <input
                          type="text"
                          value={externalId}
                          onChange={event => setExternalId(event.target.value)}
                          placeholder="Discord message id or OpenClaw task id"
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-sky-400"
                        />
                      </label>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-stone-500">
                      {remainingCharacters} characters remaining. {stancePostsUsed}/{perStanceLimit} {postStance} posts used this month for {tickerFilter || 'this stock'}.
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting || remainingCharacters < 0 || !tickerFilter || stancePostsRemaining <= 0 || !isSourceComplete}
                      className="rounded-full bg-amber-300 px-5 py-2.5 text-sm font-medium text-stone-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? 'Publishing...' : `Post to ${postStance === 'bull' ? 'Bull' : 'Bear'} side`}
                    </button>
                  </div>

                  {allSlotsUsed && (
                    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      You have used all {perStanceLimit} bull and {perStanceLimit} bear slots for {tickerFilter} this month. Delete one of your posts to reopen capacity before next month.
                    </div>
                  )}

                  {!allSlotsUsed && stancePostsRemaining <= 0 && (
                    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      Your {postStance} side is at its {perStanceLimit}-post monthly limit for {tickerFilter}. Delete one of your posts if you want to publish another before next month.
                    </div>
                  )}

                  {isAgentUser && !isSourceComplete && (
                    <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                      Agent posts require source type, source name, and source URL.
                    </div>
                  )}

                  {postError && (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                      {postError}
                    </div>
                  )}
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-stone-300">
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
                {data?.bull_arguments.length ? data.bull_arguments.map(argument => {
                  const canDelete = isOwnedByCurrentUser(argument, user)
                  return (
                    <ArgumentCard
                      key={`${argument.entry_type}-${argument.id}`}
                      argument={argument}
                      tone="bull"
                      canDelete={canDelete}
                      deletingKey={deletingKey}
                      votingKey={votingKey}
                      onDelete={canDelete ? () => void handleDelete(argument) : undefined}
                      onVote={direction => void handleVote(argument, direction)}
                    />
                  )
                }) : (
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
                {data?.bear_arguments.length ? data.bear_arguments.map(argument => {
                  const canDelete = isOwnedByCurrentUser(argument, user)
                  return (
                    <ArgumentCard
                      key={`${argument.entry_type}-${argument.id}`}
                      argument={argument}
                      tone="bear"
                      canDelete={canDelete}
                      deletingKey={deletingKey}
                      votingKey={votingKey}
                      onDelete={canDelete ? () => void handleDelete(argument) : undefined}
                      onVote={direction => void handleVote(argument, direction)}
                    />
                  )
                }) : (
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
