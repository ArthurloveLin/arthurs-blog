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

function AwardCard({ item, rank, label, color }: { item: AwardsItem, rank: number, label: string, color: 'gold' | 'silver' | 'bronze' }) {
  const configs = {
    gold: {
      border: 'border-yellow-500/50',
      badge: 'bg-yellow-500 text-black',
      glow: 'shadow-yellow-500/30',
      gradient: 'from-yellow-400 to-orange-600',
      icon: '🥇'
    },
    silver: {
      border: 'border-slate-400/50',
      badge: 'bg-slate-300 text-black',
      glow: 'shadow-slate-400/20',
      gradient: 'from-slate-300 to-slate-500',
      icon: '🥈'
    },
    bronze: {
      border: 'border-amber-700/50',
      badge: 'bg-amber-700 text-white',
      glow: 'shadow-amber-900/20',
      gradient: 'from-amber-600 to-amber-900',
      icon: '🥉'
    }
  }[color]

  return (
    <div className="flex flex-col items-center group">
       <div className={`relative aspect-[3/4] w-full rounded-3xl overflow-hidden border-4 ${configs.border} shadow-2xl ${configs.glow} transition-transform duration-500 group-hover:-translate-y-4`}>
          <Image
            src={item.image_url}
            alt={label}
            fill
            sizes="(max-width: 768px) 200px, 400px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          
          {rank === 1 && <div className="absolute inset-0 animate-champion-shine opacity-60" />}
          
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${configs.badge} text-[10px] font-black tracking-widest uppercase`}>
              <span>{configs.icon}</span>
              {label}
            </div>
          </div>
       </div>
       <div className="mt-4 text-center">
          <p className="text-white/60 text-[10px] font-black tracking-[0.2em] uppercase">{color}</p>
          {item.price && <p className="text-white font-mono font-bold">¥{item.price}</p>}
       </div>
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
  return (
    <div className="text-center w-full max-w-4xl animate-in fade-in zoom-in duration-1000">
      <div className="mb-12 relative">
        <div className="absolute inset-0 -top-20 flex justify-center pointer-events-none">
           <div className="w-96 h-96 bg-violet-500/20 blur-[120px] rounded-full animate-pulse" />
        </div>
        <span className="inline-block px-5 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-500 text-[10px] md:text-xs font-black tracking-[0.2em] uppercase mb-6 border border-yellow-500/20 shadow-[0_0_30px_rgba(234,179,8,0.1)]">
          🏆 Tournament Finished
        </span>
        <h2 className="text-3xl md:text-6xl font-black text-white mb-4 tracking-tighter">Your {templateConfig?.name || 'Life Lens'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500">Elite</span></h2>
        <p className="text-white/40 text-[10px] md:text-sm font-medium px-6">The results are in. These {templateConfig?.itemLabel || 'items'} represent your ultimate choice.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-end px-4 max-h-[50vh] md:max-h-none overflow-y-auto md:overflow-visible pb-4">
        {/* Runner Up */}
        <div className="order-2 md:order-1 animate-in slide-in-from-bottom-8 duration-700 delay-200 w-full max-w-[160px] md:max-w-none mx-auto">
          <AwardCard item={results.runnerUp} rank={2} label="Runner Up" color="silver" />
        </div>
        
        {/* Champion */}
        <div className="order-1 md:order-2 scale-100 md:scale-110 z-10 animate-in slide-in-from-bottom-12 duration-1000 w-full max-w-[200px] md:max-w-none mx-auto">
          <AwardCard item={results.champion} rank={1} label="Champion" color="gold" />
        </div>
        
        {/* Third Place */}
        {results.thirdPlace && (
          <div className="order-3 animate-in slide-in-from-bottom-8 duration-700 delay-400 w-full max-w-[140px] md:max-w-none mx-auto">
            <AwardCard item={results.thirdPlace} rank={3} label="Third Place" color="bronze" />
          </div>
        )}
      </div>

      <div className="mt-8 md:mt-20 flex flex-col items-center gap-4">
        {saving && (
           <p className="text-yellow-500/60 text-xs animate-pulse font-mono">Saving ranks to database...</p>
        )}
        <button
          onClick={onClose}
          className="px-12 py-4 bg-white text-black rounded-2xl font-black text-sm tracking-widest uppercase hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(255,255,255,0.1)] group"
        >
          <span className="group-hover:animate-bounce inline-block mr-2">✦</span>
          Return to Selection
        </button>
      </div>
    </div>
  )
}
