export interface Subreddit {
  id: number
  name: string
  display_name: string
  stock_ticker: string | null
  created_at: string
}

export interface Author {
  id: number
  reddit_username: string
  total_posts: number
  average_score: number
  highest_score: number
  created_at: string
  updated_at: string
}

export interface Analysis {
  id: number
  summary: string | null
  quality_score: number | null
  methodology_score: number | null
  sources_score: number | null
  reasoning_score: number | null
  objectivity_score: number | null
  feedback: string | null
  analyzed_at: string
}

export interface Post {
  id: number
  reddit_id: string
  subreddit_id: number
  author_id: number
  title: string
  body: string | null
  url: string
  score: number
  created_utc: string
  fetched_at: string
}

export interface PostDetail extends Post {
  subreddit: Subreddit
  author: {
    id: number
    reddit_username: string
    average_score: number
  }
  analysis: Analysis | null
}

export interface AuthorDetail extends Author {
  posts: PostDetail[]
}

export interface Stats {
  subreddits: number
  authors: number
  posts: number
  analyzed: number
  analysis_rate: number
  top_authors: {
    username: string
    average_score: number
    total_posts: number
  }[]
}
