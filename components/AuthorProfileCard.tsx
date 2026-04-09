'use client'

import { useState, useEffect, useMemo, memo, unstable_ViewTransition as ViewTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Settings, MapPin, Globe, MessageCircle, Check, Copy, Mail } from 'lucide-react'

import { useSiteData } from './SiteDataProvider'
import { useAuth } from './AuthProvider'

const STATUS_EMOJI_MAP: Record<string, string> = {
  '工作中': '👨‍💻',
  '休息中': '🏖️',
  '学习中': '📚',
  '正在上线': '🚀',
  '干饭中': '🍱',
  '沉思中': '💡',
  '挂机中': '💤',
}

const AuthorProfileCard = memo(function AuthorProfileCard({ compact = false, id }: { compact?: boolean; id?: string }) {
  const { config, stats } = useSiteData()
  const { role: userRole } = useAuth()
  const isAdmin = userRole === 'admin'

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
  const [mounted, setMounted] = useState(false)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

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
      className={`bg-card text-card-foreground rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] relative group border border-border/50 dark:border-white/10 z-10 hover:z-30 ${compact ? 'p-5' : 'p-6'}`}
      style={{ overflowAnchor: 'none' }}
    >
      
      {/* Admin Settings Button (Top-Right) */}
      {mounted && isAdmin && (
        <Link 
          href="/admin/settings"
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-xl transition duration-200 z-20"
          aria-label="系统设置"
        >
          <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
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
        
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${compact ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`}>
            {(role || company) && (
              <div className="flex items-center justify-center gap-1.5 mt-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 dark:bg-white/5 py-1 px-3 rounded-full w-fit mx-auto border border-border/40 dark:border-white/10">
                {role && <span>{role}</span>}
                {role && company && <span className="opacity-30">/</span>}
                {company && <span className="text-foreground/80">{company}</span>}
              </div>
            )}
            
            {location && (
              <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-muted-foreground font-medium">
                 <MapPin className="w-3 h-3 opacity-60" strokeWidth={2} />
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
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${compact ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'}`}>
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
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${compact ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`}>
        <div className="flex justify-center gap-2 mb-6">
          {github && (
            <a
              href={`https://github.com/${github}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`GitHub: ${github}`}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 bg-muted/40 rounded-xl hover:bg-muted/80 border border-border/40"
            >
              <Globe className="w-5 h-5" strokeWidth={1.75} />
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
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 3333 3333" aria-hidden="true">
                <path d="M1529 2271c-289,29 -539,-102 -558,-292 -19,-189 201,-366 490,-395 289,-29 538,102 557,292 19,189 -200,367 -489,395l0 0zm-77 -225c-28,45 -87,64 -132,44 -45,-21 -58,-72 -30,-116 28,-43 85,-63 130,-44 45,19 60,71 32,116zm93 -118c-11,17 -33,25 -50,18 -18,-7 -23,-26 -13,-43 10,-16 31,-25 49,-17 17,7 22,26 13,44l1 -2 0 0zm12 -198c-137,-36 -293,33 -352,154 -61,124 -2,261 137,306 144,46 313,-25 372,-159 58,-130 -14,-264 -157,-301zm550 -89c-25,-7 -42,-13 -30,-44 28,-71 31,-132 0,-175 -56,-81 -211,-77 -389,-2 0,0 -56,24 -42,-20 28,-88 23,-162 -19,-204 -98,-97 -354,3 -573,224 -164,165 -259,339 -259,490 0,289 370,464 733,464 474,0 791,-276 791,-495 0,-132 -113,-207 -212,-239l0 1 0 0zm138 -370c-55,-62 -138,-86 -215,-70 -31,7 -51,38 -44,68 6,31 37,50 67,44 37,-8 78,3 105,34 27,30 34,71 23,107 -10,29 6,62 37,72 29,8 62,-8 72,-38 24,-74 9,-158 -47,-220l2 3 0 0zm176 -159c-114,-128 -284,-176 -440,-143 -36,7 -59,43 -51,78 8,36 43,59 79,52 111,-24 231,11 312,100 80,91 103,214 68,321 -12,35 8,73 43,84 35,12 72,-7 84,-43 49,-151 18,-325 -97,-452l2 3 0 0z"/>
              </svg>
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
              <MessageCircle className="w-5 h-5 transition-opacity duration-150 group-hover/wechat:opacity-0" strokeWidth={1.75} aria-hidden="true" />
              {/* Copy / check icon — shown on hover */}
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/wechat:opacity-100 transition-opacity duration-150" aria-hidden="true">
                {copiedText === 'wechat' ? (
                  <Check className="w-5 h-5 text-emerald-500" strokeWidth={2} />
                ) : (
                  <Copy className="w-5 h-5" strokeWidth={2} />
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
              <Mail className="w-5 h-5 transition-opacity duration-150 group-hover/email:opacity-0" strokeWidth={1.75} aria-hidden="true" />
              {/* Copy / check icon — shown on hover */}
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/email:opacity-100 transition-opacity duration-150" aria-hidden="true">
                {copiedText === 'email' ? (
                  <Check className="w-5 h-5 text-emerald-500" strokeWidth={2} />
                ) : (
                  <Copy className="w-5 h-5" strokeWidth={2} />
                )}
              </span>
            </button>
          )}
          {!github && !weibo && !wechat && !email && <div className="h-9" />}
        </div>
      </div>

      {/* Stats Divider */}
      <div className={`border-t border-border transition-all duration-300 ease-in-out ${compact ? 'mb-4 mt-2' : 'mb-6'}`} />

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

export default AuthorProfileCard
