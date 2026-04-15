'use client'

import { ThumbsDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, useCallback } from 'react'
import type { ReactionValue } from '@/lib/comment-reactions'
import { COMMON_REACTION_EMOJIS } from '@/lib/emoji'

interface ReactionToggleBarProps {
  upvotes: number
  downvotes: number
  viewerReaction: ReactionValue
  pending?: boolean
  onReact: (value: 1 | -1) => void
  onEmojiReact?: (emoji: string) => void
  viewerEmojis?: string[]
  emojiPending?: boolean
  compact?: boolean
  variant?: 'pill' | 'bare'
  emphasis?: 'default' | 'hero'
  className?: string
}


import gsap from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
gsap.registerPlugin(DrawSVGPlugin)

type LikeAnimationMode = 'idle' | 'like' | 'unlike'
type DislikeAnimationMode = 'idle' | 'impact' | 'release'

const sparkleGrowColors = ['#9E31E2','#9E31E2','#9E31E2','#92E8C5','#CDEB8E','#2AD492','#D79DF3']
const sparkleMoveColors = ['#E187D2', '#E0A3FF', '#F5BB30', '#9ECA98', '#35A0F0', '#BADAB0', '#33B6E9']

function LikeReactionGlyph({
  active,
  compact,
  emphasis,
  mode,
  animationKey,
}: {
  active: boolean
  compact: boolean
  emphasis: 'default' | 'hero'
  mode: LikeAnimationMode
  animationKey: number
}) {
  const cssId = useId().replace(/:/g, '')
  const tlRef = useRef<gsap.core.Timeline | null>(null)

  // Lazy timeline builder to ensure BBox is perfectly available
  const buildTimeline = useCallback(() => {
    const q = (id: string) => `#${id}-${cssId}`

    gsap.set([q('breakLineL'), q('breakLineR')], { drawSVG: '100% 100%' })

    const tl = gsap.timeline({ paused: true })
    tl.timeScale(4)

    tl.fromTo(q('pinkDot'), { attr: { r: 0 } }, { duration: 1, attr: { r: 66 } })
      .set(q('greyHeart'), { scale: 0, svgOrigin: '300 340.5' }, '-=0.99')
      .to(q('pinkDot'), { duration: 1, fill: '#CD8FF7' }, '-=1')
      .fromTo(q('hole'), { attr: { r: 0 } }, { duration: 1, attr: { r: 67 } }, '-=0.5')
      .fromTo(q('pinkHeart'), { scale: 0, opacity: 1 }, { duration: 1.6, scale: 1, opacity: 1, svgOrigin: '300 300', ease: 'back.out(1.2)' }, '-=0.5')
      .set([q('sparkleGrowGroup'), q('sparkleMoveGroup')], { opacity: 1 }, '-=1.5')
      .to(q('sparkleGrowGroup'), { duration: 1, scale: 1.5, svgOrigin: '300 300' }, '-=1.5')
      .to(q('sparkleMoveGroup'), { duration: 1, scale: 1.2, svgOrigin: '300 300' }, '-=1.5')
      .to(`${q('sparkleGrowGroup')} circle`, { duration: 2, attr: { r: 0 }, stagger: 0, fill: (i: number) => sparkleGrowColors[i] }, '-=0.9')
      .to(`${q('sparkleMoveGroup')} circle`, { duration: 0.8, attr: { r: 0 }, stagger: 0, fill: (i: number) => sparkleMoveColors[i] }, '-=2')
      .set(q('pinkHeart'), { clearProps: 'transform' })
      // Midpoint pause — exactly like original's setUndoLike callback
      .addLabel('midpoint')
      .call(() => { tl.pause() })
      // Offset zero-duration sets by a tiny fraction so they execute AFTER resuming, preventing them from firing during the pause
      .set(q('brokenHeartGroup'), { opacity: 1 }, '+=0.01')
      .set(q('pinkHeart'), { opacity: 0 }, '<')
      .to([q('breakLineL'), q('breakLineR')], { duration: 3, drawSVG: '0% 100%' }, '<')
      .to(q('brokenHeartL'), { duration: 4, rotation: -90, svgOrigin: '300 340.5', ease: 'power2.in' }, '-=1.5')
      .to(q('brokenHeartR'), { duration: 4, rotation: 90, svgOrigin: '300 340.5', ease: 'power2.in' }, '-=4')
      .to(q('greyHeart'), { duration: 3, scale: 1, ease: 'power4.inOut' }, '-=1.6')
      .set([q('breakLineL'), q('breakLineR')], { drawSVG: '0% 0%' }, '-=3')
      .to([q('brokenHeartL'), q('brokenHeartR')], { duration: 0.3, opacity: 0 }, '-=2')
      // Reset state at end so play(0) replays correctly next time
      .call(() => {
        gsap.set(q('hole'), { attr: { r: 0 } })
        gsap.set(q('pinkDot'), { attr: { r: 0 }, fill: '#E52951' })
        gsap.set([q('brokenHeartL'), q('brokenHeartR')], { opacity: 1, rotation: 0 })
        gsap.set([q('sparkleGrowGroup'), q('sparkleMoveGroup')], { scale: 1, opacity: 0 })
        gsap.set(`${q('sparkleGrowGroup')} circle`, { attr: { r: 5 } })
        gsap.set(`${q('sparkleMoveGroup')} circle`, { attr: { r: 5 } })
        gsap.set(q('brokenHeartGroup'), { opacity: 0 })
        tl.pause(0)
      })

    return tl
  }, [cssId])

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (tlRef.current) tlRef.current.kill()
    }
  }, [])

  // Static state synchronization to guarantee visual presentation outside of active animations
  useEffect(() => {
    // Only resolve static properties if NOT actively animating to avoid timeline conflicts
    if (mode !== 'idle') return

    const q = (id: string) => `#${id}-${cssId}`
    if (active) {
      gsap.set(q('pinkHeart'), { opacity: 1, clearProps: 'transform' })
      gsap.set(q('greyHeart'), { scale: 0, svgOrigin: '300 340.5' })
      gsap.set([q('sparkleGrowGroup'), q('sparkleMoveGroup')], { opacity: 0 })
      gsap.set(q('brokenHeartGroup'), { opacity: 0 })
      gsap.set([q('brokenHeartL'), q('brokenHeartR')], { opacity: 1, rotation: 0 })
    } else {
      gsap.set(q('pinkHeart'), { opacity: 0, scale: 0, svgOrigin: '300 300' })
      gsap.set(q('greyHeart'), { clearProps: 'transform' })
      gsap.set([q('sparkleGrowGroup'), q('sparkleMoveGroup')], { opacity: 0 })
      gsap.set(q('brokenHeartGroup'), { opacity: 0 })
      gsap.set([q('brokenHeartL'), q('brokenHeartR')], { opacity: 1, rotation: 0 })
    }
  }, [cssId, active, mode])

  // Drive the timeline from explicit mode
  useEffect(() => {
    if (mode === 'idle') return
    
    // Lazy initialize to guarantee DOM is definitively loaded and BBox isn't 0
    if (!tlRef.current) {
      tlRef.current = buildTimeline()
    }
    const tl = tlRef.current

    if (!tl) return

    if (mode === 'like') {
      tl.play(0)
    } else if (mode === 'unlike') {
      if (tl.time() > 0 && tl.time() < (tl.labels.midpoint || 0)) {
        tl.pause('midpoint')
      }
      tl.play()
    }
  }, [mode, animationKey, buildTimeline])

  return (
    <span
      className={[
        'reaction-glyph reaction-glyph--like',
        compact ? 'reaction-glyph--compact' : '',
        emphasis === 'hero' ? 'reaction-glyph--hero' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <svg viewBox="250 250 100 100" className="reaction-glyph__svg block w-full h-full" overflow="visible">
        <defs>
          <mask id={cssId}>
            <circle id={`whiteDot-${cssId}`} fill="#FFFFFF" cx="300" cy="300.5" r="66"/>
            <circle id={`hole-${cssId}`} cx="300" cy="300.5" r="0"/>    
          </mask>
        </defs>
        
        <path id={`greyHeart-${cssId}`}
          d="M318.2,259.5c-7.5,0-14.2,3.7-18.2,9.5c-4-5.7-10.7-9.5-18.2-9.5c-12.3,0-22.3,10-22.3,22.3c0,30.4,31.6,58.7,40.5,58.7s40.5-28.4,40.5-58.7C340.5,269.5,330.5,259.5,318.2,259.5z"
          fill="#AAB8C2"/>
        <path id={`pinkHeart-${cssId}`}
          d="M318.2,259.5c-7.5,0-14.2,3.7-18.2,9.5c-4-5.7-10.7-9.5-18.2-9.5c-12.3,0-22.3,10-22.3,22.3c0,30.4,31.6,58.7,40.5,58.7s40.5-28.4,40.5-58.7C340.5,269.5,330.5,259.5,318.2,259.5z"
          fill="#E2264D"/>

        <g mask={`url(#${cssId})`}>
          <circle id={`pinkDot-${cssId}`} fill="#E52951" cx="300" cy="300.5" r="0"/>
        </g>
        <g id={`sparkleGrowGroup-${cssId}`} opacity="0">
          <circle fill="#91D1F9" cx="310.7" cy="239" r="5"/>
          <circle fill="#91D1F9" cx="235.7" cy="305" r="5"/>
          <circle fill="#8CE9C4" cx="254.7" cy="252" r="5"/>
          <circle fill="#8CE9C4" cx="359.7" cy="322" r="5"/>
          <circle fill="#F48DA6" cx="332.7" cy="361" r="5"/>
          <circle fill="#CB8EF4" cx="357.7" cy="267" r="5"/>
          <circle fill="#91D1F9" cx="273.7" cy="363" r="5"/>
        </g> 
        <g id={`sparkleMoveGroup-${cssId}`} opacity="0">
          <circle fill="#91D1F9" cx="300.7" cy="229" r="5"/>
          <circle fill="#91D1F9" cx="263.7" cy="353" r="5"/>
          <circle fill="#8CE9C4" cx="243.7" cy="257" r="5"/>
          <circle fill="#8CE9C4" cx="367.7" cy="312" r="5"/>
          <circle fill="#F48DA6" cx="320.7" cy="353" r="5"/>
          <circle fill="#CB8EF4" cx="233.7" cy="317" r="5"/>
          <circle fill="#CB8EF4" cx="353.7" cy="255" r="5"/>
        </g> 
        <g id={`brokenHeartGroup-${cssId}`} opacity="0">
          <path id={`brokenHeartR-${cssId}`} fill="#E2264D" d="M299.9,340.5c8.9,0,40.5-28.4,40.5-58.7c0-12.3-10-22.3-22.3-22.3
            c-7.5,0-14.2,3.7-18.2,9.5l4,7.3l-11.8,15.5l11.3,11.3l-7.8,12.8l7.3,9l-4,6.7L300,340.5z"/>
          <path id={`brokenHeartL-${cssId}`} fill="#E2264D" d="M300.1,269c-4-5.7-10.7-9.5-18.2-9.5c-12.3,0-22.3,10-22.3,22.3
            c0,30.4,31.6,58.7,40.5,58.7l-1-9l4-6.7l-7.3-9l7.8-12.8l-11.3-11.3l11.8-15.5L300,269z"/>  
          <path id={`breakLineL-${cssId}`} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeMiterlimit="10" d="M300,340.5l-1-9l4-6.7l-7.3-9
            l7.8-12.8l-11.3-11.3l11.8-15.5l-4-7.3"/>
          <path id={`breakLineR-${cssId}`} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeMiterlimit="10" d="M300,340.5l-1-9l4-6.7l-7.3-9
            l7.8-12.8l-11.3-11.3l11.8-15.5l-4-7.3"/>
        </g>  
      </svg>
    </span>
  )
}

function DislikeReactionGlyph({
  active,
  compact,
  emphasis,
  mode,
  animationKey,
}: {
  active: boolean
  compact: boolean
  emphasis: 'default' | 'hero'
  mode: DislikeAnimationMode
  animationKey: number
}) {
  return (
    <span
      key={`dislike-${mode}-${animationKey}-${active ? 'active' : 'idle'}`}
      className={[
        'reaction-glyph reaction-glyph--dislike',
        compact ? 'reaction-glyph--compact' : '',
        emphasis === 'hero' ? 'reaction-glyph--hero' : '',
        active ? 'is-active' : '',
        mode === 'impact' ? 'reaction-glyph--anim-impact' : '',
        mode === 'release' ? 'reaction-glyph--anim-release' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <span className="reaction-dislike__ripple" />
      <span className="reaction-dislike__dust reaction-dislike__dust--left" />
      <span className="reaction-dislike__dust reaction-dislike__dust--center" />
      <span className="reaction-dislike__dust reaction-dislike__dust--right" />
      <span className="reaction-dislike__burst">
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            key={`${animationKey}-${index}`}
            className="reaction-dislike__shard"
            style={{ ['--burst-index' as string]: String(index) }}
          />
        ))}
      </span>
      <ThumbsDown
        className="reaction-dislike__icon"
        size={compact ? 14 : emphasis === 'hero' ? 30 : 18}
        strokeWidth={2}
        fill={active || mode === 'impact' ? 'currentColor' : 'none'}
      />
    </span>
  )
}

export default function ReactionToggleBar({
  upvotes,
  downvotes,
  viewerReaction,
  pending = false,
  onReact,
  onEmojiReact,
  viewerEmojis = [],
  emojiPending = false,
  compact = false,
  variant = 'pill',
  emphasis = 'default',
  className = '',
}: ReactionToggleBarProps) {
  const [wheelOpen, setWheelOpen] = useState(false)
  const [likeAnimation, setLikeAnimation] = useState<LikeAnimationMode>('idle')
  const [likeAnimationKey, setLikeAnimationKey] = useState(0)
  const [dislikeAnimation, setDislikeAnimation] = useState<DislikeAnimationMode>('idle')
  const [dislikeAnimationKey, setDislikeAnimationKey] = useState(0)
  const pressTimerRef = useRef<number | null>(null)
  const likeAnimationTimerRef = useRef<number | null>(null)
  const dislikeAnimationTimerRef = useRef<number | null>(null)
  const suppressLikeClickRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const likeButtonRef = useRef<HTMLButtonElement>(null)
  const isHero = emphasis === 'hero' && !compact
  const containerClassName = compact
    ? 'gap-1.5 text-[10px]'
    : isHero
      ? 'gap-3 text-[11px]'
      : 'gap-2 text-[11px]'
  const buttonClassName = isHero
    ? 'min-h-[4.8rem] min-w-[5.5rem] rounded-[20px] px-4 py-2.5'
    : variant === 'bare'
      ? compact
        ? 'h-7 px-0.5'
        : 'h-8 px-1'
      : compact
        ? 'h-7 rounded-full px-2.5'
        : 'h-8 rounded-full px-3'
  const contentClassName = isHero ? 'flex-col gap-2' : 'flex-row gap-1.5'
  const countClassName = isHero
    ? 'text-[1.2rem] font-semibold leading-none tracking-[-0.03em]'
    : 'tabular-nums transition-transform duration-200'
  const glyphClassName = isHero ? 'h-7 w-7' : compact ? 'h-4 w-4' : 'h-[1.15rem] w-[1.15rem]'

  function clearLongPressTimer() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  function clearLikeAnimationTimer() {
    if (likeAnimationTimerRef.current !== null) {
      window.clearTimeout(likeAnimationTimerRef.current)
      likeAnimationTimerRef.current = null
    }
  }

  function clearDislikeAnimationTimer() {
    if (dislikeAnimationTimerRef.current !== null) {
      window.clearTimeout(dislikeAnimationTimerRef.current)
      dislikeAnimationTimerRef.current = null
    }
  }

  function triggerLikeAnimation(mode: LikeAnimationMode) {
    clearLikeAnimationTimer()
    setLikeAnimationKey((value) => value + 1)
    setLikeAnimation(mode)
    likeAnimationTimerRef.current = window.setTimeout(() => {
      setLikeAnimation('idle')
      likeAnimationTimerRef.current = null
    }, mode === 'unlike' ? 1750 : 950)
  }

  function triggerDislikeAnimation(mode: DislikeAnimationMode) {
    clearDislikeAnimationTimer()
    setDislikeAnimationKey((value) => value + 1)
    setDislikeAnimation(mode)
    dislikeAnimationTimerRef.current = window.setTimeout(() => {
      setDislikeAnimation('idle')
      dislikeAnimationTimerRef.current = null
    }, mode === 'impact' ? 760 : 520)
  }

  useEffect(() => {
    if (!wheelOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setWheelOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setWheelOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [wheelOpen])

  useEffect(() => () => {
    clearLongPressTimer()
    clearLikeAnimationTimer()
    clearDislikeAnimationTimer()
  }, [])

  function startLongPress() {
    if (!onEmojiReact || pending || emojiPending) {
      return
    }

    clearLongPressTimer()
    pressTimerRef.current = window.setTimeout(() => {
      suppressLikeClickRef.current = true
      setWheelOpen(true)
    }, 360)
  }

  function handleLikeClick() {
    if (suppressLikeClickRef.current) {
      suppressLikeClickRef.current = false
      return
    }

    if (viewerReaction === 1) {
      triggerLikeAnimation('unlike')
    } else {
      triggerLikeAnimation('like')
      if (viewerReaction === -1) {
        triggerDislikeAnimation('release')
      }
    }

    onReact(1)
  }

  return (
    <div ref={containerRef} className={['flex items-center', containerClassName, className].filter(Boolean).join(' ')}>
      <div className="relative inline-flex items-center justify-center">
        <button
          ref={likeButtonRef}
          type="button"
          aria-pressed={viewerReaction === 1}
          disabled={pending}
          onPointerDown={startLongPress}
          onPointerUp={clearLongPressTimer}
          onPointerLeave={clearLongPressTimer}
          onPointerCancel={clearLongPressTimer}
          onClick={handleLikeClick}
          onContextMenu={(event) => {
            if (!onEmojiReact || pending || emojiPending) {
              return
            }

            event.preventDefault()
            clearLongPressTimer()
            setWheelOpen(true)
          }}
          title={onEmojiReact ? '点赞，长按或右键可选择 emoji' : undefined}
          className={[
            variant !== 'bare' ? 'reaction-toggle-button' : '',
            'reaction-toggle-button--like inline-flex items-center justify-center transition-all duration-200 ease-out',
            contentClassName,
            buttonClassName,
            variant === 'bare'
              ? viewerReaction === 1
                ? 'text-rose-600'
                : 'text-slate-500 hover:text-rose-600'
              : viewerReaction === 1
                ? 'border border-rose-300/60 bg-[linear-gradient(180deg,rgba(255,241,244,0.98),rgba(255,228,235,0.92))] text-rose-600 shadow-[0_16px_34px_-20px_rgba(244,63,94,0.55)]'
                : 'border border-black/10 bg-white/70 text-slate-500 hover:border-rose-200 hover:text-rose-600',
            pending && viewerReaction === 1 ? 'scale-[1.04] -translate-y-px animate-pulse' : '',
            pending ? 'cursor-wait opacity-70' : '',
          ].filter(Boolean).join(' ')}
        >
          <span className={glyphClassName}>
            <LikeReactionGlyph
              active={viewerReaction === 1}
              compact={compact}
              emphasis={emphasis}
              mode={likeAnimation}
              animationKey={likeAnimationKey}
            />
          </span>
          <span className={countClassName}>{upvotes}</span>
        </button>

        {onEmojiReact ? (
          <div className={['emoji-radial-wheel', wheelOpen ? 'emoji-radial-wheel--open' : ''].join(' ')}>
            {COMMON_REACTION_EMOJIS.map((emoji, index) => (
              <button
                key={emoji}
                type="button"
                className={[
                  'emoji-radial-wheel__item',
                  viewerEmojis.includes(emoji) ? 'emoji-radial-wheel__item--active' : '',
                ].filter(Boolean).join(' ')}
                style={{ ['--emoji-index' as string]: String(index), ['--emoji-total' as string]: String(COMMON_REACTION_EMOJIS.length) }}
                onClick={() => {
                  onEmojiReact(emoji)
                  setWheelOpen(false)
                }}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        aria-pressed={viewerReaction === -1}
        disabled={pending}
        onClick={() => {
          setWheelOpen(false)

          if (viewerReaction === -1) {
            triggerDislikeAnimation('release')
          } else {
            triggerDislikeAnimation('impact')
            if (viewerReaction === 1) {
              triggerLikeAnimation('unlike')
            }
          }

          onReact(-1)
        }}
        className={[
          variant !== 'bare' ? 'reaction-toggle-button' : '',
          'reaction-toggle-button--dislike inline-flex items-center justify-center transition-all duration-200 ease-out',
          contentClassName,
          buttonClassName,
          variant === 'bare'
            ? viewerReaction === -1
              ? 'text-amber-700'
              : 'text-slate-500 hover:text-amber-700'
            : viewerReaction === -1
              ? 'border border-amber-300/70 bg-[linear-gradient(180deg,rgba(255,249,235,0.98),rgba(255,241,204,0.92))] text-amber-700 shadow-[0_16px_34px_-20px_rgba(245,158,11,0.52)]'
              : 'border border-black/10 bg-white/70 text-slate-500 hover:border-amber-200 hover:text-amber-700',
          pending && viewerReaction === -1 ? 'scale-[1.04] -translate-y-px animate-pulse' : '',
          pending ? 'cursor-wait opacity-70' : '',
        ].filter(Boolean).join(' ')}
      >
        <span className={glyphClassName}>
          <DislikeReactionGlyph
            active={viewerReaction === -1}
            compact={compact}
            emphasis={emphasis}
            mode={dislikeAnimation}
            animationKey={dislikeAnimationKey}
          />
        </span>
        <span className={countClassName}>{downvotes}</span>
      </button>
    </div>
  )
}