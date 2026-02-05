import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';
import readingTime from 'reading-time';

const postsDirectory = path.join(process.cwd(), 'content/blog');

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  author: string;
  coverImage?: string;
  tags: string[];
  readingTime: string;
  content?: string;
}

interface PostFrontmatter {
  title?: string;
  date?: string;
  excerpt?: string;
  author?: string;
  coverImage?: string;
  tags?: string[];
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  const allPosts = fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, '');
      return getPostBySlug(slug);
    })
    .filter((post): post is BlogPost => post !== null);

  return allPosts.sort((a, b) => (a.date > b.date ? -1 : 1));
}

export function getPostBySlug(slug: string): BlogPost | null {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.md`);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    const frontmatter = data as PostFrontmatter;
    const stats = readingTime(content);

    return {
      slug,
      title: frontmatter.title || 'Untitled',
      date: frontmatter.date || new Date().toISOString(),
      excerpt: frontmatter.excerpt || content.slice(0, 160) + '...',
      author: frontmatter.author || 'Clawork Team',
      coverImage: frontmatter.coverImage,
      tags: frontmatter.tags || [],
      readingTime: stats.text,
    };
  } catch {
    return null;
  }
}

export async function getPostContent(slug: string): Promise<string> {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { content } = matter(fileContents);

  // Process markdown with full GFM support and syntax highlighting
  const processedContent = await remark()
    .use(remarkGfm) // GitHub Flavored Markdown: tables, strikethrough, task lists, autolinks
    .use(remarkRehype, { allowDangerousHtml: true }) // Convert to rehype (HTML)
    .use(rehypeSlug) // Add IDs to headings
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' }) // Make headings linkable
    .use(rehypeHighlight, { detect: true }) // Syntax highlighting for code blocks
    .use(rehypeStringify, { allowDangerousHtml: true }) // Convert to HTML string
    .process(content);

  return processedContent.toString();
}

export function getAllPostSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  return fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => fileName.replace(/\.md$/, ''));
}
