# Blog Enhancement PRD

## Overview
This document outlines backend features required for a modern, mature blog experience.

## Phase 1: Core Features (Priority: High)

### 1.1 Dark Mode Persistence
**Description**: Persist user's theme preference across sessions
**Requirements**:
- Store theme preference in Supabase user profile (requires authentication) or localStorage
- Provide server-side theme detection based on user preference
- Sync theme across all pages
**Technical Details**:
- Create `user_preferences` table in Supabase
- API endpoint: `POST /api/user/preferences` (save theme)
- API endpoint: `GET /api/user/preferences` (get saved preferences)

### 1.2 Blog Search Functionality
**Description**: Full-text search across all published posts
**Requirements**:
- Search by title, content, tags
- Highlight matching terms in results
- Pagination for search results
- Search suggestions/autocomplete
**Technical Details**:
- Use Supabase full-text search or external search service (Algolia/Meilisearch)
- API endpoint: `GET /api/blog/search?q={query}&page={page}`
- Create `blog_search` view/function in Supabase
- Consider adding search index trigger for real-time updates

## Phase 2: Content Features (Priority: Medium)

### 2.1 Featured Images
**Description**: Add cover images to blog posts
**Requirements**:
- Store featured image URL in posts table
- Display on post cards and detail pages
- Support different aspect ratios
- Fallback to placeholder image
**Technical Details**:
- Add `featured_image` column to `posts` table
- Extract from frontmatter during reindex
- Image optimization via Next.js Image component
- Default placeholder design

### 2.2 Reading Time Estimation
**Description**: Calculate and display estimated reading time
**Requirements**:
- Average 200-250 words per minute
- Display on post cards and detail page
- Consider code blocks reading time differently
**Technical Details**:
- Client-side calculation function
- Store in database or calculate on-the-fly
- Consider caching for performance

### 2.3 Author Information System
**Description**: Support multiple authors with profiles
**Requirements**:
- Author name, bio, avatar
- Author page showing all posts
- Display on post cards and detail page
**Technical Details**:
- Create `authors` table
- Add `author_id` foreign key to `posts` table
- Extract author from frontmatter
- API endpoint: `GET /api/authors/{id}`

## Phase 3: Engagement Features (Priority: Low)

### 3.1 View Counting
**Description**: Track and display post view counts
**Requirements**:
- Increment view count on each visit
- Display on post cards (optional) and detail page
- Avoid counting duplicate views from same user (session/IP)
**Technical Details**:
- Add `view_count` column to `posts` table
- Increment via API: `POST /api/blog/{slug}/view`
- Use Redis or similar for rate limiting
- Consider privacy implications (GDPR)

### 3.2 Like/Bookmark System
**Description**: Allow users to like or bookmark posts
**Requirements**:
- Like count display
- Bookmark for later reading
- Sync across devices (requires authentication)
**Technical Details**:
- Create `post_likes` table (user_id, post_id)
- Create `bookmarks` table (user_id, post_id)
- API endpoints:
  - `POST /api/posts/{id}/like`
  - `POST /api/posts/{id}/bookmark`
  - `GET /api/bookmarks` (user's bookmarks)

### 3.3 Newsletter Subscription
**Description**: Email newsletter for new posts
**Requirements**:
- Subscription form on homepage
- Double opt-in confirmation
- Unsubscribe functionality
- Digest options (instant, daily, weekly)
**Technical Details**:
- Create `newsletter_subscribers` table (email, frequency, status)
- Email service integration (Resend/SendGrid)
- API endpoint: `POST /api/newsletter/subscribe`
- Scheduled job for sending newsletters

### 3.4 Related Posts
**Description**: Show related posts based on tags or content
**Requirements**:
- Display 3-5 related posts
- Consider tags, category, or similarity algorithm
- Performance optimization (caching)
**Technical Details**:
- API endpoint: `GET /api/blog/{slug}/related`
- Supabase function for tag-based recommendations
- Consider embedding similarity for content matching
- Cache results in Redis

## Phase 4: Advanced Features (Priority: Future)

### 4.1 Comments System (Already exists)
**Status**: ✅ Implemented

### 4.2 Social Sharing
**Description**: Share buttons for social platforms
**Requirements**:
- Twitter/X, Facebook, LinkedIn, Copy Link
- Open Graph tags for rich previews
- Twitter Card support
**Technical Details**:
- Frontend component with sharing URLs
- Add OG tags to metadata
- Add Twitter Card meta tags

### 4.3 Table of Contents
**Description**: Auto-generated TOC for long posts
**Requirements**:
- Extract headings from markdown
- Sticky sidebar on desktop
- Smooth scroll to section
- Highlight current section
**Technical Details**:
- Client-side TOC generation
- Intersection Observer for scroll tracking
- Add to MarkdownRenderer component

### 4.4 RSS/Atom Feed
**Description**: Provide RSS feed for readers
**Requirements**:
- Full post content or excerpt
- Support for all published posts
- Valid RSS 2.0 format
**Technical Details**:
- API endpoint: `/api/rss.xml`
- Generate XML dynamically
- Update on reindex

## Database Schema Changes Required

```sql
-- User Preferences
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  theme VARCHAR(20) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Authors
CREATE TABLE authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Update posts table
ALTER TABLE posts
ADD COLUMN featured_image TEXT,
ADD COLUMN author_id UUID REFERENCES authors(id),
ADD COLUMN view_count INTEGER DEFAULT 0,
ADD COLUMN reading_time INTEGER;

-- Post Likes
CREATE TABLE post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Bookmarks
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Newsletter Subscribers
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  frequency VARCHAR(20) DEFAULT 'instant', -- instant, daily, weekly
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, unsubscribed
  confirmation_token UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints Summary

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/user/preferences` | GET/POST | Theme preferences | Yes |
| `/api/blog/search` | GET | Search posts | No |
| `/api/authors/:id` | GET | Author info | No |
| `/api/posts/:id/like` | POST | Like/unlike post | Yes |
| `/api/posts/:id/bookmark` | POST | Add/remove bookmark | Yes |
| `/api/bookmarks` | GET | User's bookmarks | Yes |
| `/api/newsletter/subscribe` | POST | Subscribe newsletter | No |
| `/api/blog/:slug/view` | POST | Increment view count | No |
| `/api/blog/:slug/related` | GET | Related posts | No |
| `/api/rss.xml` | GET | RSS feed | No |

## Implementation Priority Order

1. ✅ **Phase 1.1**: Dark mode persistence (UI ready, backend needed)
2. **Phase 1.2**: Search functionality
3. **Phase 2.1**: Featured images
4. **Phase 2.2**: Reading time
5. **Phase 2.3**: Author system
6. **Phase 3.1**: View counting
7. **Phase 3.2**: Like/bookmark system
8. **Phase 3.3**: Newsletter
9. **Phase 3.4**: Related posts
10. **Phase 4**: Advanced features

## Notes

- All features should respect user privacy and implement necessary security measures
- Consider rate limiting for public APIs
- Implement proper error handling and validation
- Use caching where appropriate for performance
- Ensure responsive design for all new components
