import { useState } from 'react'
import { usePosts, useSubreddits } from '../hooks'
import { Loading, ErrorMessage, PostCard } from '../components'

export default function Posts() {
  const [filters, setFilters] = useState({
    subreddit: '',
    analyzed_only: false,
    sort_by: 'created_utc' as string,
    sort_order: 'desc' as string,
  })

  const { data, isLoading, error } = usePosts({
    limit: 20,
    ...filters,
    subreddit: filters.subreddit || undefined,
  })
  const { data: subreddits } = useSubreddits()

  if (error) return <ErrorMessage message={(error as Error).message} />

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Posts</h1>
      <p className="text-gray-600 mb-6">
        Browse and filter analyzed research posts
      </p>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <select
            value={filters.subreddit}
            onChange={e => setFilters(f => ({ ...f, subreddit: e.target.value }))}
            className="px-3 py-2 border rounded"
          >
            <option value="">All Subreddits</option>
            {subreddits?.subreddits.map(sub => (
              <option key={sub.id} value={sub.name}>r/{sub.name}</option>
            ))}
          </select>

          <select
            value={filters.sort_by}
            onChange={e => setFilters(f => ({ ...f, sort_by: e.target.value }))}
            className="px-3 py-2 border rounded"
          >
            <option value="created_utc">Date Posted</option>
            <option value="quality_score">Quality Score</option>
            <option value="reddit_score">Reddit Score</option>
          </select>

          <select
            value={filters.sort_order}
            onChange={e => setFilters(f => ({ ...f, sort_order: e.target.value }))}
            className="px-3 py-2 border rounded"
          >
            <option value="desc">Highest First</option>
            <option value="asc">Lowest First</option>
          </select>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.analyzed_only}
              onChange={e => setFilters(f => ({ ...f, analyzed_only: e.target.checked }))}
              className="rounded"
            />
            <span>Analyzed only</span>
          </label>
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : data && data.posts.length > 0 ? (
        <>
          <p className="text-gray-500 mb-4">{data.total} posts found</p>
          <div className="space-y-4">
            {data.posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">No posts found</p>
          <p className="text-gray-400 mt-2">
            Try changing your filters or fetch some posts first
          </p>
        </div>
      )}
    </div>
  )
}
