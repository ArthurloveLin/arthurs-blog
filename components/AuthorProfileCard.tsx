'use client'

import { useState, useMemo, memo, unstable_ViewTransition as ViewTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'

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

const AuthorProfileCard = memo(function AuthorProfileCard({ compact = false }: { compact?: boolean }) {
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
      className={`bg-card text-card-foreground rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] relative group border border-border/50 dark:border-white/10 z-10 hover:z-30 ${compact ? 'p-5' : 'p-6'}`}
    >
      
      {/* Admin Settings Button (Top-Right) */}
      {isAdmin && (
        <Link 
          href="/admin/settings" 
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-xl transition duration-200 z-20"
          title="系统设置"
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </Link>
      )}
      
      {/* Avatar & Status */}
      <ViewTransition name="author-avatar" share="morph">
        <div className="flex justify-center">
          <div className="relative">
            {avatarUrl ? (
              <div
                className="relative rounded-full overflow-hidden shadow-[0_4px_16px_rgb(0,0,0,0.12)] border-2 border-background bg-muted w-22 h-22"
              >
                <Image src={avatarUrl} alt={name} fill className="object-cover" unoptimized />
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
      <ViewTransition name="author-name">
        <div className="text-center mt-5">
          <h2
            className="text-xl font-bold text-gradient-primary tracking-tight"
          >
            {name}
          </h2>
        
        {!compact && (
          <>
            {(role || company) && (
              <div className="flex items-center justify-center gap-1.5 mt-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 dark:bg-white/5 py-1 px-3 rounded-full w-fit mx-auto border border-border/40 dark:border-white/10">
                {role && <span>{role}</span>}
                {role && company && <span className="opacity-30">/</span>}
                {company && <span className="text-foreground/80">{company}</span>}
              </div>
            )}
            
            {location && (
              <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-muted-foreground/70 font-medium">
                 <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 {location}
              </div>
            )}
          </>
        )}
      </div>
    </ViewTransition>
      
      {/* Bio / Motto - Shown in both modes, but slightly different spacing */}
      <p className="text-sm text-foreground/70 text-center leading-relaxed mt-4 mb-5 italic font-serif px-2">
        {`"${bio}"`}
      </p>

      {!compact && skillList.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 mb-5 px-1">
          {skillList.map((skill) => (
            <span key={skill} className="px-2 py-0.5 rounded-md bg-muted/60 text-[10px] font-bold text-muted-foreground border border-border/50">
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Contact Info (WeChat & Email) */}
      {!compact && (wechat || email) && (
        <div className="mb-6 flex flex-col gap-2 bg-muted/20 dark:bg-white/5 p-3 rounded-xl border border-border/50 dark:border-white/5">
          {wechat && (
            <div 
              className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground group/item cursor-pointer hover:text-foreground transition-colors"
              onClick={() => copyToClipboard(wechat, 'wechat')}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <svg className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.288 5.76c-.368 0-.72.032-1.072.064C4.24 6.208 2 8.448 2 11.232c0 1.696.848 3.168 2.224 4.16a.6.6 0 0 1 .208.432c0 .12-.032.224-.128.384l-.56 1.12c-.064.128-.096.224-.096.32 0 .224.16.416.416.416.096 0 .192-.032.288-.096l1.792-.896a.8.8 0 0 1 .416-.096c.224 0 .416.032.608.096.368.096.752.16 1.152.16 3.456 0 6.272-2.368 6.272-5.408S11.744 5.76 8.288 5.76Zm-2.4 4c-.432 0-.8-.368-.8-.8s.368-.8.8-.8.8.368.8.8-.368.8-.8.8Zm3.36 0c-.432 0-.8-.368-.8-.8s.368-.8.8-.8.8.368.8.8-.368.8-.8.8ZM18.4 11c-.32 0-.64.032-.96.064.256.416.384.864.384 1.344 0 2.272-2.112 4.096-4.704 4.096-.192 0-.384-.016-.576-.032 1.056 1.632 2.912 2.688 5.056 2.688.352 0 .672-.032 1.024-.08a.56.56 0 0 1 .512.064c.224.128.48.288.768.448l1.344.672c.064.032.16.064.224.064.192 0 .32-.16.32-.352 0-.096-.032-.192-.096-.288l-.416-.8c-.064-.128-.096-.224-.096-.32 0-.256.096-.384.224-.544C21.84 17.024 22.5 15.68 22.5 14.2c0-2.656-1.84-4.832-4.1-5.2Zm-1.76 3.36c-.32 0-.576-.256-.576-.576 0-.32.256-.576.576-.576.32 0 .576.256.576.576 0 .32-.256.576-.576.576Zm2.56 0c-.32 0-.576-.256-.576-.576 0-.32.256-.576.576-.576.32 0 .576.256.576.576 0 .32-.256.576-.576.576Z" />
                </svg>
                <span className="font-mono tracking-tight truncate">{wechat}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                <span className="text-[9px] font-bold uppercase tracking-tighter">
                  {copiedText === 'wechat' ? '已复制' : '复制'}
                </span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          )}
          {email && (
            <div 
              className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground group/item cursor-pointer hover:text-foreground transition-colors"
              onClick={() => copyToClipboard(email, 'email')}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <svg className="w-3.5 h-3.5 text-sky-500/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-mono tracking-tight truncate">{email}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                <span className="text-[9px] font-bold uppercase tracking-tighter">
                  {copiedText === 'email' ? '已复制' : '复制'}
                </span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Social Links */}
      {!compact && (
        <div className="flex justify-center mb-6">
          {github ? (
            <a href={`https://github.com/${github}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-2 bg-muted/40 rounded-xl hover:bg-muted/80 border border-border/40">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
            </a>
          ) : null}
          {weibo && (
            <a href={weibo} target="_blank" rel="noopener noreferrer" className="ml-2 text-muted-foreground hover:text-[#E6162D] transition-colors p-2 bg-muted/40 rounded-xl hover:bg-muted/80 border border-border/40">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 3333 3333">
                <path d="M1529 2271c-289,29 -539,-102 -558,-292 -19,-189 201,-366 490,-395 289,-29 538,102 557,292 19,189 -200,367 -489,395l0 0zm-77 -225c-28,45 -87,64 -132,44 -45,-21 -58,-72 -30,-116 28,-43 85,-63 130,-44 45,19 60,71 32,116zm93 -118c-11,17 -33,25 -50,18 -18,-7 -23,-26 -13,-43 10,-16 31,-25 49,-17 17,7 22,26 13,44l1 -2 0 0zm12 -198c-137,-36 -293,33 -352,154 -61,124 -2,261 137,306 144,46 313,-25 372,-159 58,-130 -14,-264 -157,-301zm550 -89c-25,-7 -42,-13 -30,-44 28,-71 31,-132 0,-175 -56,-81 -211,-77 -389,-2 0,0 -56,24 -42,-20 28,-88 23,-162 -19,-204 -98,-97 -354,3 -573,224 -164,165 -259,339 -259,490 0,289 370,464 733,464 474,0 791,-276 791,-495 0,-132 -113,-207 -212,-239l0 1 0 0zm138 -370c-55,-62 -138,-86 -215,-70 -31,7 -51,38 -44,68 6,31 37,50 67,44 37,-8 78,3 105,34 27,30 34,71 23,107 -10,29 6,62 37,72 29,8 62,-8 72,-38 24,-74 9,-158 -47,-220l2 3 0 0zm176 -159c-114,-128 -284,-176 -440,-143 -36,7 -59,43 -51,78 8,36 43,59 79,52 111,-24 231,11 312,100 80,91 103,214 68,321 -12,35 8,73 43,84 35,12 72,-7 84,-43 49,-151 18,-325 -97,-452l2 3 0 0z"/>
              </svg>
            </a>
          )}
          {!github && !weibo && <div className="h-9" />}
        </div>
      )}

      {/* Stats Divider */}
      <div className={`border-t border-border ${compact ? 'mb-4 mt-2' : 'mb-6'}`} />

      {/* Stats */}
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

    </div>
  )
})

export default AuthorProfileCard
