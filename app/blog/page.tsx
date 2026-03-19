import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import BlogListClient from './bloglist';
import { Post } from '../components/blog'; // Or define it locally

export default function BlogPage() {
  const postsDirectory = path.join(process.cwd(), 'posts');

  if (!fs.existsSync(postsDirectory)) {
    return (
      <div className="p-10 text-red-500">
        <h1>Error: /posts folder not found.</h1>
      </div>
    );
  }

  const fileNames = fs.readdirSync(postsDirectory);

  const posts: Post[] = fileNames.map((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(postsDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data } = matter(fileContents);

    return {
      slug,
      title: data.title,
      date: data.date,
      description: data.description,
    };
  });

  return (
    <div className="max-w-2xl mx-auto p-10">
      <h1 className="text-3xl font-bold mb-8">Blog Posts</h1>
      <BlogListClient posts={posts} />
    </div>
  );
}