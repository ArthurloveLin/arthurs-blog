export const BLOG_RETURN_PATHNAME_KEY = 'blog-return:pathname'
export const BLOG_RETURN_POST_SLUG_KEY = 'blog-return:post-slug'
export const BLOG_RETURN_CURRENT_POST_ID_KEY = 'blog-return:current-post-id'
export const BLOG_RETURN_CURRENT_POST_SLUG_KEY = 'blog-return:current-post-slug'
export const BLOG_RETURN_TARGET_EVENT = 'blog-return-target-change'

export function getPostAnchorHref(postId: string) {
  return `/#post-${postId}`
}
