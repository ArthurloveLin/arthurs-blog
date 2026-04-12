'use client'

import { useState, useMemo, memo, ViewTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { useSiteConfig, useSiteStats } from './SiteDataProvider'
import { useAuth } from './AuthProvider'
import { GitHubIcon, WeChatIcon, WeiboIcon } from './SocialIcons'

const STATUS_EMOJI_MAP: Record<string, string> = {
  '工作中': '👨‍💻',
  '休息中': '🏖️',
  '学习中': '📚',
  '正在上线': '🚀',
  '干饭中': '🍱',
  '沉思中': '💡',
  '挂机中': '💤',
}

interface AuthorProfileCardProps {
  id?: string
}

interface AuthorProfileCardBodyProps extends AuthorProfileCardProps {
  compact?: boolean
}

const AuthorProfileCardBody = memo(function AuthorProfileCardBody({ compact = false, id }: AuthorProfileCardBodyProps) {
  const config = useSiteConfig()
  const stats = useSiteStats()
  const { isAdmin } = useAuth()
  const isCompact = compact

  const {
    author_name: name = 'Arthur & Grace',
    author_bio: bio = '技术、生活与创意的记录者',
    author_avatar_url: avatarUrl,
    author_role: role,
    author_company: company,
    author_location: location,
    author_skills: skills,
    author_status: status,
    author_github: github,
    author_weibo: weibo,
    author_wechat: wechat,
    author_email: email,
  } = config

  const { postsCount, categoriesCount, tagsCount } = stats

  const skillList = useMemo(() =>
    skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : []
  , [skills])
  const statusEmoji = status ? STATUS_EMOJI_MAP[status] || '✨' : null
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(type)
      setTimeout(() => setCopiedText(null), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  return (
    <div
      className={`bg-card text-card-foreground rounded-2xl shadow-[3px_5px_30px_rgba(0,0,0,0.04)] dark:shadow-none transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[3px_8px_36px_rgba(0,0,0,0.08)] relative group border border-border/50 dark:border-white/10 z-10 hover:z-30 ${isCompact ? 'p-5' : 'p-6'}`}
      style={{ overflowAnchor: 'none' }}
    >

      {/* Admin Settings Button (Top-Right) */}
      {isAdmin && (
        <Link
          href="/admin/settings"
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-xl transition duration-200 z-20"
          aria-label="系统设置"
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </Link>
      )}

      {/* Avatar & Status */}
      <ViewTransition name={id ? `${id}-author-avatar` : "author-avatar"} share="morph">
        <div className="flex justify-center">
          <div className="relative">
            {avatarUrl ? (
              <div
                className="relative rounded-full overflow-hidden shadow-[0_4px_16px_rgb(0,0,0,0.12)] border-2 border-background bg-muted w-22 h-22"
              >
                <Image
                  src={avatarUrl}
                  alt={name}
                  fill
                  className="object-cover"
                  sizes="88px"
                />
              </div>
            ) : (
              <div
                className="rounded-full bg-gradient-primary flex items-center justify-center shadow-[0_4px_16px_rgb(0,0,0,0.12)] border-2 border-background dark:border-white/10 w-22 h-22 text-sm"
              >
                <span className="text-primary-foreground font-bold tracking-tight">A&G</span>
              </div>
            )}

            {/* Status Badge */}
            {statusEmoji && (
              <div
                className="absolute -bottom-1 -right-1 bg-card border border-border rounded-full flex items-center justify-center shadow-md animate-bounce-subtle z-10 select-none w-8 h-8 text-sm"
              >
                {statusEmoji}
              </div>
            )}
          </div>
        </div>
      </ViewTransition>

      {/* Basic Info */}
      <ViewTransition name={id ? `${id}-author-name` : "author-name"}>
        <div className="text-center mt-5">
          <h2
            className="text-xl font-bold text-gradient-primary tracking-tight"
          >
            {name}
          </h2>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCompact ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`}>
            {(role || company) && (
              <div className="flex items-center justify-center gap-1.5 mt-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 dark:bg-white/5 py-1 px-3 rounded-full w-fit mx-auto border border-border/40 dark:border-white/10">
                {role && <span>{role}</span>}
                {role && company && <span className="opacity-30">/</span>}
                {company && <span className="text-foreground/80">{company}</span>}
              </div>
            )}

            {location && (
              <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-muted-foreground font-medium">
                 <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 {location}
              </div>
            )}
          </div>
      </div>
    </ViewTransition>

      {/* Bio / Motto - Shown in both modes, but slightly different spacing */}
      <ViewTransition name={id ? `${id}-author-bio` : "author-bio"} enter="fade-in" default="none">
        <p className="text-sm text-foreground/70 text-center leading-relaxed mt-4 mb-5 italic font-serif px-2">
          {`"${bio}"`}
        </p>
      </ViewTransition>

      {skillList.length > 0 && (
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCompact ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'}`}>
          <div className="flex flex-wrap justify-center gap-1.5 mb-5 px-1">
            {skillList.map((skill) => (
              <span key={skill} className="px-2 py-0.5 rounded-md bg-muted/60 text-[10px] font-bold text-muted-foreground border border-border/50">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Social Links (GitHub, Weibo, WeChat, Email) */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCompact ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`}>
        <div className="flex justify-center gap-2 mb-6">
          {github && (
            <a
              href={`https://github.com/${github}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`GitHub: ${github}`}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 bg-muted/40 rounded-xl hover:bg-muted/80 border border-border/40"
            >
              <GitHubIcon className="w-5 h-5" />
            </a>
          )}
          {weibo && (
            <a
              href={weibo}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="微博主页"
              className="text-muted-foreground hover:text-[#E6162D] transition-colors p-2 bg-muted/40 rounded-xl hover:bg-muted/80 border border-border/40"
            >
              <WeiboIcon className="w-5 h-5" />
            </a>
          )}
          {wechat && (
            <button
              type="button"
              aria-label={copiedText === 'wechat' ? '微信号已复制' : `复制微信号: ${wechat}`}
              onClick={() => copyToClipboard(wechat, 'wechat')}
              className="group/wechat relative text-muted-foreground hover:text-emerald-500 transition-colors p-2 bg-muted/40 rounded-xl hover:bg-muted/80 border border-border/40 cursor-pointer"
            >
              {/* WeChat icon — hidden on hover */}
              <WeChatIcon className="w-5 h-5 transition-opacity duration-150 group-hover/wechat:opacity-0" aria-hidden="true" />
              {/* Copy / check icon — shown on hover */}
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/wechat:opacity-100 transition-opacity duration-150" aria-hidden="true">
                {copiedText === 'wechat' ? (
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                )}
              </span>
            </button>
          )}
          {email && (
            <button
              type="button"
              aria-label={copiedText === 'email' ? '邮箱已复制' : `复制邮箱: ${email}`}
              onClick={() => copyToClipboard(email, 'email')}
              className="group/email relative text-muted-foreground hover:text-sky-500 transition-colors p-2 bg-muted/40 rounded-xl hover:bg-muted/80 border border-border/40 cursor-pointer"
            >
              {/* Email icon — hidden on hover */}
              <svg className="w-5 h-5 transition-opacity duration-150 group-hover/email:opacity-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {/* Copy / check icon — shown on hover */}
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/email:opacity-100 transition-opacity duration-150" aria-hidden="true">
                {copiedText === 'email' ? (
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                )}
              </span>
            </button>
          )}
          {!github && !weibo && !wechat && !email && <div className="h-9" />}
        </div>
      </div>

      {/* Stats Divider */}
      <div className={`border-t border-border transition-all duration-300 ease-in-out ${isCompact ? 'mb-4 mt-2' : 'mb-6'}`} />

      {/* Stats */}
      <ViewTransition name={id ? `${id}-author-stats` : "author-stats"} enter="fade-in" default="none">
        <div className="flex items-center justify-around translate-y-1">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-bold text-foreground tabular-nums">{postsCount}</span>
            <span className="text-[11px] text-muted-foreground">文章</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-bold text-foreground tabular-nums">{categoriesCount}</span>
            <span className="text-[11px] text-muted-foreground">分类</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-bold text-foreground tabular-nums">{tagsCount}</span>
            <span className="text-[11px] text-muted-foreground">标签</span>
          </div>
        </div>
      </ViewTransition>

    </div>
  )
})

const AuthorProfileCard = memo(function AuthorProfileCard(props: AuthorProfileCardProps) {
  return <AuthorProfileCardBody {...props} />
})

export const AuthorProfileCompactCard = memo(function AuthorProfileCompactCard(props: AuthorProfileCardProps) {
  return <AuthorProfileCardBody {...props} compact />
})

export const SidebarAuthorProfileCard = memo(function SidebarAuthorProfileCard(props: AuthorProfileCardBodyProps) {
  return <AuthorProfileCardBody {...props} />
})

export default AuthorProfileCard
