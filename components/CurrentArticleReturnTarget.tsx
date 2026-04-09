'use client'

import { useEffect } from 'react'
import {
  BLOG_RETURN_CURRENT_POST_ID_KEY,
  BLOG_RETURN_CURRENT_POST_SLUG_KEY,
  BLOG_RETURN_TARGET_EVENT,
  getPostAnchorHref,
} from '@/lib/blog-return'

interface CurrentArticleReturnTargetProps {
  postId: string
  postSlug: string
}

export default function CurrentArticleReturnTarget({ postId, postSlug }: CurrentArticleReturnTargetProps) {
  useEffect(() => {
    const href = getPostAnchorHref(postId)

    sessionStorage.setItem(BLOG_RETURN_CURRENT_POST_ID_KEY, postId)
    sessionStorage.setItem(BLOG_RETURN_CURRENT_POST_SLUG_KEY, postSlug)
    window.dispatchEvent(new CustomEvent(BLOG_RETURN_TARGET_EVENT, { detail: { href, postSlug } }))
  }, [postId, postSlug])

  return null
}
