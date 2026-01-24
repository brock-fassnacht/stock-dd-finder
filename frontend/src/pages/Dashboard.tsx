import { Link } from 'react-router-dom'
import { useStats, useSubreddits } from '../hooks'
import { Loading, ErrorMessage } from '../components'
import { triggerFetch, createSubreddit } from '../api'
import { useState } from 'react'

export default function Dashboard() {
  const { data: stats, isLoading, error, refetch } = useStats()
  const { data: subreddits } = useSubreddits()
  const [fetching, setFetching] = useState(false)
  const [newSubreddit, setNewSubreddit] = useState({ name: '', display_name: '', stock_ticker: '' })

  const handleFetch = async () => {
    setFetching(true)
    try {
      await triggerFetch({ limit: 50, analyze: true })
      alert('Fetch started! This may take a few moments.')
      setTimeout(() => refetch(), 5000)
    } catch (err) {
      alert('Failed to trigger fetch')
    }
    setFetching(false)
  }

  const handleAddSubreddit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createSubreddit(newSubreddit)
      setNewSubreddit({ name: '', display_name: '', stock_ticker: '' })
      window.location.reload()
    } catch (err) {
      alert('Failed to add subreddit')
    }
  }

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message={(error as Error).message} />
  if (!stats) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Track and analyze stock research quality from Reddit
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-blue-600">{stats.subreddits}</div>
          <div className="text-gray-500">Subreddits</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-blue-600">{stats.authors}</div>
          <div className="text-gray-500">Authors</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-blue-600">{stats.posts}</div>
          <div className="text-gray-500">Posts</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-blue-600">{stats.analysis_rate}%</div>
          <div className="text-gray-500">Analyzed</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Authors */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Top Authors</h2>
          {stats.top_authors.length > 0 ? (
            <div className="space-y-3">
              {stats.top_authors.map((author, i) => (
                <Link
                  key={author.username}
                  to={`/author/${author.username}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">#{i + 1}</span>
                    <div>
                      <div className="font-medium">u/{author.username}</div>
                      <div className="text-sm text-gray-500">{author.total_posts} posts</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-blue-600">
                    {author.average_score.toFixed(1)}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No authors yet. Fetch some posts!</p>
          )}
          <Link
            to="/leaderboard"
            className="block mt-4 text-center text-blue-600 hover:text-blue-800"
          >
            View full leaderboard
          </Link>
        </div>

        {/* Admin Actions */}
        <div className="space-y-6">
          {/* Tracked Subreddits */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Tracked Subreddits</h2>
            {subreddits?.subreddits && subreddits.subreddits.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subreddits.subreddits.map(sub => (
                  <span
                    key={sub.id}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    r/{sub.name} {sub.stock_ticker && `(${sub.stock_ticker})`}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No subreddits tracked yet</p>
            )}
          </div>

          {/* Add Subreddit */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Add Subreddit</h2>
            <form onSubmit={handleAddSubreddit} className="space-y-3">
              <input
                type="text"
                placeholder="Subreddit name (e.g. ASTSpaceMobile)"
                value={newSubreddit.name}
                onChange={e => setNewSubreddit(s => ({ ...s, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
                required
              />
              <input
                type="text"
                placeholder="Display name (e.g. AST SpaceMobile)"
                value={newSubreddit.display_name}
                onChange={e => setNewSubreddit(s => ({ ...s, display_name: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
                required
              />
              <input
                type="text"
                placeholder="Stock ticker (optional)"
                value={newSubreddit.stock_ticker}
                onChange={e => setNewSubreddit(s => ({ ...s, stock_ticker: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                Add Subreddit
              </button>
            </form>
          </div>

          {/* Fetch Posts */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Fetch Posts</h2>
            <p className="text-sm text-gray-600 mb-4">
              Fetch and analyze new posts from all tracked subreddits
            </p>
            <button
              onClick={handleFetch}
              disabled={fetching || !subreddits?.subreddits?.length}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {fetching ? 'Fetching...' : 'Fetch & Analyze Posts'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
