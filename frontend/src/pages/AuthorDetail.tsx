import { useParams, Link } from 'react-router-dom'
import { useAuthor } from '../hooks'
import { Loading, ErrorMessage, PostCard, ScoreBar } from '../components'

export default function AuthorDetail() {
  const { username } = useParams<{ username: string }>()
  const { data: author, isLoading, error } = useAuthor(username || '')

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message={(error as Error).message} />
  if (!author) return null

  return (
    <div>
      <Link to="/leaderboard" className="text-blue-600 hover:text-blue-800 text-sm">
        Back to Leaderboard
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">u/{author.reddit_username}</h1>
        <p className="text-gray-500">
          Member since {new Date(author.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-blue-600">
            {author.average_score.toFixed(1)}
          </div>
          <div className="text-gray-500">Average Score</div>
          <div className="mt-2">
            <ScoreBar score={author.average_score} max={100} showValue={false} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-green-600">
            {author.highest_score.toFixed(1)}
          </div>
          <div className="text-gray-500">Highest Score</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-gray-700">
            {author.total_posts}
          </div>
          <div className="text-gray-500">Analyzed Posts</div>
        </div>
      </div>

      {/* Posts */}
      <h2 className="text-xl font-semibold mb-4">Posts</h2>
      {author.posts && author.posts.length > 0 ? (
        <div className="space-y-4">
          {author.posts.map(post => (
            <PostCard key={post.id} post={post} showAuthor={false} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No posts found
        </div>
      )}
    </div>
  )
}
