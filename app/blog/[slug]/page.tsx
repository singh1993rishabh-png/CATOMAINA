import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// 1. Interface for the Frontmatter
interface PostData {
  title: string;
  date: string;
  description?: string;
}

// 2. Next.js 15 requires params to be a Promise
interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PostPage({ params }: PageProps) {
  // Await the params to get the slug
  const { slug } = await params;

  const postsDirectory = path.join(process.cwd(), 'posts');
  const fullPath = path.join(postsDirectory, `${slug}.md`);

  // 3. Safety Check: If the file doesn't exist, trigger 404
  if (!fs.existsSync(fullPath)) {
    notFound();
  }

  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    
    // Type assertion for our metadata
    const typedData = data as PostData;

    // 4. Transform Markdown to HTML string
    const processedContent = await remark()
      .use(html)
      .process(content);
    const contentHtml = processedContent.toString();

    // 5. The Return statement must be inside the try block
    return (
      <article className="max-w-2xl mx-auto py-12 px-6">
        <Link 
          href="/blog" 
          className="text-sm text-blue-600 hover:underline mb-8 inline-block"
        >
          ← Back to all posts
        </Link>

        <header className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
            {typedData.title || slug}
          </h1>
          <p className="text-gray-500">{typedData.date}</p>
        </header>

        {/* 6. Render the markdown content */}
        <div
          className="prose prose-blue lg:prose-xl max-w-none"
          dangerouslySetInnerHTML={{ __html: contentHtml }} 
        />
      </article>
    );
  } catch (error) {
    console.error("Markdown parsing error:", error);
    return (
      <div className="p-10 text-center">
        <p className="text-red-500">Error loading post content.</p>
        <Link href="/blog" className="text-blue-500 underline">Return to Blog</Link>
      </div>
    );
  }
}