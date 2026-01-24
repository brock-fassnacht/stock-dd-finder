import { useParams, Link } from 'react-router-dom'
import { usePost } from '../hooks'
import { Loading, ErrorMessage, ScoreBar } from '../components'

export default function PostDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: post, isLoading, error } = usePost(Number(id))

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message={(error as Error).message} />
  if (!post) return null

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div>
      <Link to="/posts" className="text-blue-600 hover:text-blue-800 text-sm">
        Back to Posts
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{post.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-gray-500">
          <span className="px-2 py-1 bg-gray-100 rounded">r/{post.subreddit.name}</span>
          <Link
            to={`/author/${post.author.reddit_username}`}
            className="text-blue-600 hover:text-blue-800"
          >
            u/{post.author.reddit_username}
          </Link>
          <span>{formatDate(post.created_utc)}</span>
          <span>+{post.score} upvotes</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Content</h2>
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">{post.body}</p>
            </div>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-blue-600 hover:text-blue-800"
            >
              View on Reddit
            </a>
          </div>
        </div>

        {/* Analysis Sidebar */}
        <div className="lg:col-span-1">
          {post.analysis ? (
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">Analysis</h2>

              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-blue-600">
                  {post.analysis.quality_score?.toFixed(0)}
                </div>
                <div className="text-gray-500">Quality Score</div>
              </div>

              <div className="space-y-4">
                {post.analysis.methodology_score && (
                  <ScoreBar score={post.analysis.methodology_score} label="Methodology" />
                )}
                {post.analysis.sources_score && (
                  <ScoreBar score={post.analysis.sources_score} label="Sources" />
                )}
                {post.analysis.reasoning_score && (
                  <ScoreBar score={post.analysis.reasoning_score} label="Reasoning" />
                )}
                {post.analysis.objectivity_score && (
                  <ScoreBar score={post.analysis.objectivity_score} label="Objectivity" />
                )}
              </div>

              {post.analysis.summary && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-medium mb-2">Summary</h3>
                  <p className="text-gray-600 text-sm">{post.analysis.summary}</p>
                </div>
              )}

              {post.analysis.feedback && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="font-medium mb-2">Feedback</h3>
                  <p className="text-gray-600 text-sm">{post.analysis.feedback}</p>
                </div>
              )}

              <div className="mt-4 text-xs text-gray-400">
                Analyzed {formatDate(post.analysis.analyzed_at)}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Analysis</h2>
              <p className="text-gray-500 text-center py-4">
                This post has not been analyzed yet
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
