import { Link } from 'react-router-dom'
import type { PostDetail } from '../api'
import { ScoreBar } from './ScoreBar'

interface PostCardProps {
  post: PostDetail
  showAuthor?: boolean
}

export function PostCard({ post, showAuthor = true }: PostCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <Link
            to={`/post/${post.id}`}
            className="text-lg font-medium text-blue-600 hover:text-blue-800 line-clamp-2"
          >
            {post.title}
          </Link>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <span className="px-2 py-0.5 bg-gray-100 rounded">
              r/{post.subreddit.name}
            </span>
            {showAuthor && (
              <Link
                to={`/author/${post.author.reddit_username}`}
                className="hover:text-blue-600"
              >
                u/{post.author.reddit_username}
              </Link>
            )}
            <span>{formatDate(post.created_utc)}</span>
            <span title="Reddit upvotes">+{post.score}</span>
          </div>
        </div>
        {post.analysis?.quality_score && (
          <div className="ml-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {post.analysis.quality_score.toFixed(0)}
            </div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
        )}
      </div>

      {post.analysis && (
        <div className="mt-3 pt-3 border-t">
          {post.analysis.summary && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {post.analysis.summary}
            </p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {post.analysis.methodology_score && (
              <ScoreBar
                score={post.analysis.methodology_score}
                label="Method"
                showValue={false}
              />
            )}
            {post.analysis.sources_score && (
              <ScoreBar
                score={post.analysis.sources_score}
                label="Sources"
                showValue={false}
              />
            )}
            {post.analysis.reasoning_score && (
              <ScoreBar
                score={post.analysis.reasoning_score}
                label="Logic"
                showValue={false}
              />
            )}
            {post.analysis.objectivity_score && (
              <ScoreBar
                score={post.analysis.objectivity_score}
                label="Objectivity"
                showValue={false}
              />
            )}
          </div>
        </div>
      )}

      {!post.analysis && (
        <div className="mt-3 pt-3 border-t">
          <span className="text-sm text-gray-400 italic">Not analyzed yet</span>
        </div>
      )}
    </div>
  )
}
