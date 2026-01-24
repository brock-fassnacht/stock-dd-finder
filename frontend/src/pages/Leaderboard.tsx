import { Link } from 'react-router-dom'
import { useAuthors } from '../hooks'
import { Loading, ErrorMessage, ScoreBar } from '../components'

export default function Leaderboard() {
  const { data, isLoading, error } = useAuthors({ limit: 50, min_posts: 1 })

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message={(error as Error).message} />
  if (!data) return null

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Leaderboard</h1>
      <p className="text-gray-600 mb-8">
        Top research contributors ranked by average quality score
      </p>

      {data.authors.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Author
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Best Score
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.authors.map((author, index) => (
                <tr key={author.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-lg font-bold ${
                      index === 0 ? 'text-yellow-500' :
                      index === 1 ? 'text-gray-400' :
                      index === 2 ? 'text-amber-600' :
                      'text-gray-400'
                    }`}>
                      #{index + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/author/${author.reddit_username}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      u/{author.reddit_username}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {author.total_posts}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-blue-600">
                        {author.average_score.toFixed(1)}
                      </span>
                      <div className="w-24">
                        <ScoreBar score={author.average_score} max={100} showValue={false} />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {author.highest_score.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">No ranked authors yet</p>
          <p className="text-gray-400 mt-2">
            Fetch and analyze some posts to see the leaderboard
          </p>
        </div>
      )}
    </div>
  )
}
