'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Recipe, RecipeRevision } from '@/lib/recipes'
import FlavorRadar from './FlavorRadar'
import RevisionTimeline from './RevisionTimeline'
import { ChevronLeft, ChevronRight, ChefHat, Timer, Users, Tag } from 'lucide-react'

interface Props {
  recipe: Recipe
  revisions: RecipeRevision[]
}

/**
 * Kami · 紙 Design System Tokens
 */
const KAMI = {
  parchment: '#f5f4ed',
  ivory: '#faf9f5',
  ink: 'oklch(0.25 0.02 50)', // Deep charcoal-brown instead of blue
  nearBlack: '#141413',
  olive: '#504e49',
  stone: '#6b6a64',
  border: 'oklch(0.45 0.02 50 / 0.3)', // Higher contrast divider
  borderSoft: 'oklch(0.45 0.02 50 / 0.15)', // More visible row separator
  tagBg: 'oklch(0.25 0.02 50 / 0.08)', // Neutral tag
  serif: "'LXGW WenKai Screen', serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: KAMI.serif,
      fontSize: 14,
      fontWeight: 500,
      color: KAMI.nearBlack,
      margin: '20px 0 10px 0',
      borderLeft: `2.5px solid ${KAMI.ink}`,
      paddingLeft: 8,
      letterSpacing: '0.05em',
    }}>
      {children}
    </h3>
  )
}

function MetricCard({ value, unit, label, icon: Icon }: { value: number; unit: string; label: string; icon: React.ElementType }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontFamily: KAMI.serif,
          fontSize: 18,
          fontWeight: 500,
          color: KAMI.ink,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        <span style={{ fontSize: 11, color: KAMI.stone, fontWeight: 500 }}>{unit}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: KAMI.stone, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        <Icon size={12} strokeWidth={2.5} />
        {label}
      </div>
    </div>
  )
}

export default function RecipeLeftPage({ recipe, revisions }: Props) {
  const [currentImgIndex, setCurrentImgIndex] = useState(0)
  const images = (recipe.gallery_images?.length ?? 0) > 0
    ? recipe.gallery_images
    : recipe.cover_image ? [{ url: recipe.cover_image, key: 'cover' }] : []

  const nextImg = () => setCurrentImgIndex((prev) => (prev + 1) % images.length)
  const prevImg = () => setCurrentImgIndex((prev) => (prev - 1 + images.length) % images.length)

  return (
    <div className="bs-page-scroll-content recipe-page recipe-left-content" style={{ 
      padding: '24px 28px',
      color: KAMI.nearBlack,
      fontFamily: KAMI.serif,
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      height: '100%',
    }}>

      {/* ── Header: Identification ── */}
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {recipe.category && (
            <span style={{
              backgroundColor: KAMI.tagBg,
              color: KAMI.ink,
              fontSize: 11,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 2,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              {recipe.category}
            </span>
          )}
          <div style={{ flex: 1, height: '0.5px', backgroundColor: KAMI.border }} />
          <span style={{ 
            fontFamily: KAMI.mono, 
            fontSize: 11, 
            color: KAMI.stone,
            fontWeight: 500,
            letterSpacing: '0.05em' 
          }}>
            VER. {recipe.version}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
          <h1 className="recipe-title" style={{
            fontSize: 28,
            fontWeight: 500,
            lineHeight: 1.1,
            color: KAMI.nearBlack,
            letterSpacing: '-0.02em',
            margin: 0,
          }}>
            {recipe.title}
          </h1>
          
          {recipe.recommendation_rating != null && (
            <div style={{ display: 'flex', gap: 2, color: KAMI.ink, opacity: 0.8, fontSize: 14, marginTop: 4 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ color: i < recipe.recommendation_rating! ? KAMI.ink : KAMI.borderSoft }}>
                  ★
                </span>
              ))}
            </div>
          )}
        </div>

        {recipe.description && (
          <p className="recipe-description" style={{
            fontSize: 12.5,
            color: KAMI.olive,
            lineHeight: 1.5,
            maxWidth: '90%',
          }}>
            {recipe.description}
          </p>
        )}
      </header>

      {/* ── Key Metrics ── */}
      <div className="recipe-metrics-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: 16,
        padding: '12px 0',
        borderTop: `1px solid ${KAMI.border}`,
        borderBottom: `1px solid ${KAMI.border}`,
      }}>
        <MetricCard value={recipe.prep_time_minutes ?? 0} unit="分钟" label="准备" icon={Timer} />
        <MetricCard value={recipe.cook_time_minutes ?? 0} unit="分钟" label="烹调" icon={ChefHat} />
        <MetricCard value={recipe.servings ?? 0} unit="人" label="人数" icon={Users} />
      </div>

      {/* ── Visual Context (Carousel) ── */}
      <figure style={{ margin: 0 }}>
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          aspectRatio: '16/9', 
          borderRadius: 4, 
          overflow: 'hidden', 
          backgroundColor: KAMI.ivory,
          border: `1px solid ${KAMI.border}`,
        }} className="group">
          {images.length > 0 ? (
            <>
              <Image
                src={images[currentImgIndex].url}
                alt={recipe.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="500px"
              />
              {images.length > 1 && (
                <>
                   <button onClick={prevImg} style={{ left: 8, color: KAMI.ink }} className="recipe-image-nav absolute top-1/2 -translate-y-1/2 bg-white/90 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-slate-200">
                     <ChevronLeft size={14} />
                   </button>
                   <button onClick={nextImg} style={{ right: 8, color: KAMI.ink }} className="recipe-image-nav absolute top-1/2 -translate-y-1/2 bg-white/90 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-slate-200">
                     <ChevronRight size={14} />
                   </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, i) => (
                      <div key={i} className={`w-1 h-1 rounded-full transition-all ${i === currentImgIndex ? 'bg-white w-2' : 'bg-white/40'}`} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: KAMI.stone }}>
              <ChefHat size={32} strokeWidth={1.5} />
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Visual Reference Empty</span>
            </div>
          )}
        </div>
        <figcaption style={{ fontSize: 10.5, color: KAMI.stone, marginTop: 6, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Tag size={12} /> 菜品实拍图 {images.length > 0 ? `(${currentImgIndex + 1}/${images.length})` : '(暂无)'}
        </figcaption>
      </figure>

      {/* ── Ingredients ── */}
      {recipe.ingredients.length > 0 && (
        <section>
          <SectionTitle>食材清单 · {recipe.ingredients.length}</SectionTitle>
          <div className="recipe-ingredients-grid" style={{ 
             display: 'grid', 
             gridTemplateColumns: '1fr 1fr', 
             gap: '4px 16px',
          }}>
            {recipe.ingredients.map((ing) => (
              <div key={ing.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: 12, 
                padding: '4px 0',
                borderBottom: `0.5px solid ${KAMI.borderSoft}`,
              }}>
                <span style={{ color: KAMI.nearBlack, fontWeight: 400 }}>{ing.name}</span>
                <span style={{ color: KAMI.stone, fontFamily: KAMI.mono, fontSize: 11 }}>
                  {ing.amount}{ing.unit}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Steps ── */}
      {recipe.steps.length > 0 && (
        <section>
          <SectionTitle>烹饪流程</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recipe.steps.map((step, i) => (
              <div key={step.id} style={{ display: 'flex', gap: 10 }}>
                <span style={{
                  fontFamily: KAMI.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: KAMI.ink,
                  marginTop: 1,
                  minWidth: '1.2em',
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div style={{ flex: 1 }}>
                  {step.title && (
                    <h4 style={{ fontSize: 13, fontWeight: 500, color: KAMI.nearBlack, marginBottom: 2 }}>{step.title}</h4>
                  )}
                  <p style={{ fontSize: 12, color: KAMI.olive, lineHeight: 1.45 }}>{step.description}</p>
                  {step.tip && (
                    <div style={{ 
                      marginTop: 4, 
                      padding: '4px 8px', 
                      backgroundColor: KAMI.ivory, 
                      borderLeft: `1.5px solid ${KAMI.ink}`,
                      fontSize: 10.5,
                      color: KAMI.ink,
                      fontStyle: 'italic'
                    }}>
                      {step.tip}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Secondary Analysis ── */}
       <div className="recipe-secondary-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
         <div>
           <SectionTitle>风味雷达</SectionTitle>
           <div className="recipe-flavor-radar" style={{ transform: 'scale(0.9)', transformOrigin: 'top left', marginTop: -10 }}>
             <FlavorRadar recipe={recipe} />
           </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tags */}
          {recipe.tags.length > 0 && (
            <section>
              <SectionTitle>特征标签</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 11,
                      fontFamily: KAMI.mono,
                      letterSpacing: '0.04em',
                      padding: '2px 9px',
                      borderRadius: 4,
                      border: `0.5px solid ${KAMI.border}`,
                      color: KAMI.ink,
                      background: KAMI.tagBg,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Proficiency */}
          {recipe.proficiency != null && (
            <section>
              <SectionTitle>熟练度评价</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: i < (recipe.proficiency ?? 0)
                          ? KAMI.ink
                          : KAMI.borderSoft,
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 10.5, color: KAMI.stone, marginLeft: 4, fontFamily: KAMI.mono, fontWeight: 700 }}>
                  {recipe.proficiency} / 5.0
                </span>
              </div>
            </section>
          )}

          {/* Revision History */}
          {revisions.length > 0 && (
            <section>
              <SectionTitle>修订历史</SectionTitle>
              <div style={{ fontSize: 10.5 }}>
                <RevisionTimeline revisions={revisions} />
              </div>
            </section>
          )}
        </div>
      </div>

    </div>
  )
}
