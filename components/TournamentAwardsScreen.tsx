import Image from 'next/image'

export interface AwardsItem {
  id: string
  image_url: string
  price: number | null
  category: string | null
}

export interface AwardsResults {
  champion: AwardsItem
  runnerUp: AwardsItem
  thirdPlace?: AwardsItem
}

type Rank = 'gold' | 'silver' | 'bronze'

const RANK_CONFIG: Record<Rank, {
  border: string
  glow: string
  badge: string
  label: string
  medal: string
  podiumHeight: string
}> = {
  gold: {
    border: 'border-yellow-400/60',
    glow: 'shadow-[0_8px_40px_rgba(234,179,8,0.25)]',
    badge: 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30',
    label: '冠军',
    medal: '🥇',
    podiumHeight: 'md:pt-0',
  },
  silver: {
    border: 'border-slate-400/40',
    glow: 'shadow-[0_8px_25px_rgba(148,163,184,0.15)]',
    badge: 'bg-slate-400/15 text-slate-300 border border-slate-400/25',
    label: '亚军',
    medal: '🥈',
    podiumHeight: 'md:pt-8',
  },
  bronze: {
    border: 'border-amber-700/40',
    glow: 'shadow-[0_8px_25px_rgba(180,83,9,0.12)]',
    badge: 'bg-amber-700/15 text-amber-400 border border-amber-700/30',
    label: '季军',
    medal: '🥉',
    podiumHeight: 'md:pt-12',
  },
}

function AwardCard({ item, rank }: { item: AwardsItem; rank: Rank }) {
  const cfg = RANK_CONFIG[rank]

  return (
    <div className={`flex flex-col items-center gap-3 ${cfg.podiumHeight}`}>
      {/* Medal badge */}
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide ${cfg.badge}`}>
        <span>{cfg.medal}</span>
        {cfg.label}
      </div>

      {/* Image card */}
      <div className={`relative w-full rounded-xl overflow-hidden border-2 ${cfg.border} ${cfg.glow} transition-transform duration-500 hover:-translate-y-1`}>
        <div className="aspect-[3/4]">
          <Image
            src={item.image_url}
            alt={cfg.label}
            fill
            sizes="(max-width: 768px) 33vw, 240px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {rank === 'gold' && (
            <div className="absolute inset-0 animate-champion-shine opacity-40" />
          )}
        </div>
      </div>

      {/* Price */}
      {item.price != null && (
        <span className="font-mono text-sm text-white/60 font-medium">¥{item.price}</span>
      )}
    </div>
  )
}

export function TournamentAwardsScreen({
  results,
  onClose,
  saving,
  templateConfig,
}: {
  results: AwardsResults
  onClose: () => void
  saving: boolean
  templateConfig?: import('@/lib/templates').TemplateConfig
}) {
  const name = templateConfig?.name || '穿搭'

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-700 overflow-hidden">
      {/* Header */}
      <div className="text-center space-y-2 relative">
        {/* Glow blob */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full pointer-events-none"
          style={{ background: 'var(--blob-color-1)', filter: 'blur(60px)' }} />

        <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[11px] font-medium tracking-wider">
          🏆 锦标赛结果
        </div>
        <h2 className="relative text-2xl md:text-4xl font-black text-white tracking-tight leading-tight">
          你的{' '}
          <span className="inline-block px-1 text-gradient-primary">{name}</span>{' '}
          排行榜
        </h2>
        <p className="relative text-white/35 text-xs md:text-sm">
          {results.thirdPlace ? '三件' : '两件'}单品，已决出最终名次
        </p>
      </div>

      {/* Podium */}
      <div className="w-full grid grid-cols-3 gap-3 md:gap-5 items-end px-2">
        {/* 亚军 */}
        <div className="animate-in slide-in-from-bottom-6 duration-700 delay-200">
          <AwardCard item={results.runnerUp} rank="silver" />
        </div>

        {/* 冠军 — 中间，最高凸起 */}
        <div className="animate-in slide-in-from-bottom-8 duration-700 scale-[1.04] origin-bottom z-10">
          <AwardCard item={results.champion} rank="gold" />
        </div>

        {/* 季军 */}
        {results.thirdPlace ? (
          <div className="animate-in slide-in-from-bottom-6 duration-700 delay-300">
            <AwardCard item={results.thirdPlace} rank="bronze" />
          </div>
        ) : (
          <div /> /* 占位 */
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3 pt-2">
        {saving && (
          <p className="text-white/40 text-xs font-mono animate-pulse">正在保存排名...</p>
        )}
        <button
          onClick={onClose}
          className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm tracking-wide hover:opacity-90 active:scale-95 transition-all duration-200 shadow-lg"
        >
          返回衣橱
        </button>
      </div>
    </div>
  )
}

