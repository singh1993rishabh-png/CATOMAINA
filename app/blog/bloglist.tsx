'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface Post {
  slug: string;
  title?: string;
  date?: string;
  description?: string;
}

interface BlogListProps {
  posts: Post[];
}

export default function BlogListClient({ posts = [] }: BlogListProps) {
  // Store the slug of the expanded post, or null if all are closed
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const toggleDescription = (slug: string) => {
    setExpandedSlug(prev => (prev === slug ? null : slug));
  };

  if (posts.length === 0) {
    return <p className="text-gray-500 text-center">No posts found.</p>;
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <div key={post.slug} className="border-b border-gray-100 pb-6 last:border-0">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <Link 
                href={`/blog/${post.slug}`} 
                className="text-xl font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                {post.title || post.slug}
              </Link>
              <p className="text-sm text-gray-400 mt-1">{post.date}</p>
            </div>

            <button
              onClick={() => toggleDescription(post.slug)}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            >
              {expandedSlug === post.slug ? 'Hide Info' : 'Show Description'}
            </button>
          </div>

          {/* Expanded Description Area */}
          {expandedSlug === post.slug && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-gray-700 leading-relaxed">
                {post.description || "No description provided for this article."}
              </p>
              <Link 
                href={`/blog/${post.slug}`}
                className="inline-block mt-3 text-sm font-medium text-blue-600 hover:underline"
              >
                Read full post →
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}