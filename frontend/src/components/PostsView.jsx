import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Heart,
  Image,
  Loader2,
  MessageCircle,
  RotateCw,
} from 'lucide-react';

function PostCard({ post }) {
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(post.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the ID is selectable text */
    }
  };

  const thumb = post.mediaType === 'VIDEO' ? (post.thumbnailUrl ?? post.mediaUrl) : post.mediaUrl;
  const caption = post.caption
    ? post.caption.length > 90
      ? `${post.caption.slice(0, 90)}…`
      : post.caption
    : 'No caption';

  return (
    <div className="post-card">
      {thumb ? (
        <img
          className="post-thumb"
          src={thumb}
          alt={post.caption ? `Post: ${post.caption.slice(0, 60)}` : 'Instagram post'}
          loading="lazy"
        />
      ) : (
        <div className="post-thumb post-thumb-empty" aria-hidden="true">
          <Image size={26} />
        </div>
      )}
      <div className="post-body">
        <p className="post-caption">{caption}</p>
        <div className="post-meta">
          <span className="chip">{post.mediaType?.toLowerCase().replaceAll('_', ' ')}</span>
          <span className="hint" title={new Date(post.timestamp).toLocaleString()}>
            {new Date(post.timestamp).toLocaleDateString()}
          </span>
          {typeof post.likeCount === 'number' && (
            <span className="hint post-count">
              <Heart size={12} aria-hidden="true" /> {post.likeCount}
            </span>
          )}
          {typeof post.commentsCount === 'number' && (
            <span className="hint post-count">
              <MessageCircle size={12} aria-hidden="true" /> {post.commentsCount}
            </span>
          )}
        </div>
        <div className="post-id-row">
          <code className="post-id" title="Post ID">
            {post.id}
          </code>
          <button
            type="button"
            className="ghost icon-btn small"
            onClick={copyId}
            aria-label={`Copy post ID ${post.id}`}
            title="Copy post ID"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          {post.permalink && (
            <a
              className="ghost icon-btn small link-as-btn"
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open post on Instagram"
              title="Open on Instagram"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PostsView({ fetchApi }) {
  const [posts, setPosts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi('/api/dashboard/posts');
      setPosts(data.posts ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchApi]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <Image size={17} aria-hidden="true" />
          Your posts
        </h2>
        <div className="page-actions" style={{ marginLeft: 'auto' }}>
          <span className="hint">
            Copy an ID into Automations → “Limit to specific posts”
          </span>
          <button
            type="button"
            className="ghost icon-btn"
            onClick={load}
            disabled={loading}
            aria-label="Reload posts"
            title="Reload posts"
          >
            <RotateCw size={16} className={loading ? 'spin' : undefined} />
          </button>
        </div>
      </div>

      {error && (
        <div className="banner error-banner" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" className="link-btn" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loading && !posts ? (
        <div className="empty-state">
          <Loader2 size={26} className="spin" aria-hidden="true" />
          <p>Loading posts from Instagram…</p>
        </div>
      ) : posts && posts.length === 0 && !error ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <Image size={26} strokeWidth={1.8} />
          </span>
          <strong>No posts found</strong>
          <p>Posts published by your connected Instagram professional account appear here.</p>
        </div>
      ) : (
        posts && (
          <div className="posts-grid">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )
      )}
    </section>
  );
}
