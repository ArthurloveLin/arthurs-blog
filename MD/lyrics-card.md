 Plan: Behind the Lyrics Card Beautification                                                            
                                                        
 Context

 The SpotifyGeniusLiveCard ("Behind the Lyrics") currently uses hardcoded yellow (yellow-400) for all
 highlights, indicators, and active states, with no connection to the currently-playing song's album
 art. On mobile, the right-side annotations panel stacks below the lyrics, which is awkward on small
 screens.

 Two goals:
 1. Extract accent colors from the album cover and make all interactive color elements (lyric
 highlights, annotation dot, card active states) follow those colors dynamically.
 2. On mobile, remove the stacked annotations panel and replace it with a touch-triggered floating
 popover that appears near the tapped lyric line, clamped within the viewport.

 ---
 Task 1: Album Color Extraction + Color-following Highlights

 New file: hooks/useAlbumPalette.ts

 Client-side hook that draws album image to a 60×60 canvas, quantizes pixels into buckets (4-bit shift
 per channel), filters by luminance (30–225) and saturation (>15%), sorts by saturation descending,
 picks top 2 colors as accent / accent2.

 Returns:
 interface AlbumPalette {
   accent: string        // "rgb(R, G, B)"
   accent2: string       // "rgb(R2, G2, B2)"
   accentSoft: string    // "rgba(R, G, B, 0.12)"
   markColorRgb: string  // "R G B" — space-separated for CSS rgb() usage
 }

 Fallback when no image or extraction fails: yellow rgb(250, 204, 21) (preserves current look).

 Changes to components/spotify/SpotifyGeniusLiveCard.tsx

 a) Call the hook:
 const palette = useAlbumPalette(data?.albumImageUrl)
 (data is already available from useSpotify() — SpotifyNowPlayingData includes albumImageUrl.)

 b) Inject CSS custom properties on the outer card div:
 style={{
   '--btl-accent': palette.accent,
   '--btl-accent2': palette.accent2,
   '--btl-accent-soft': palette.accentSoft,
   '--btl-mark': palette.markColorRgb,
 } as React.CSSProperties}

 c) Update the inline <style> block:

 Change the .marker-highlight::before rule:
 - --mark-color: 255 232 62 → --mark-color: var(--btl-mark, 255 232 62)
 - .marker-fixed::before: --mark-color: 255 220 0 → --mark-color: var(--btl-mark, 255 220 0)

 Add new helper classes (still inside the <style> block):
 .btl-dot { background-color: var(--btl-accent, rgb(250,204,21)); }
 .btl-dot-faint { background-color: var(--btl-accent, rgb(250,204,21)); opacity: 0.4; }
 .btl-ann-active { background-color: var(--btl-accent-soft, rgba(250,204,21,0.08)); border-color:
 var(--btl-accent, rgb(250,204,21)); }
 .btl-badge-active { background-color: var(--btl-accent, rgb(250,204,21)); color: #000; }
 .btl-badge-inactive { background-color: var(--btl-accent-soft, rgba(250,204,21,0.1)); color:
 var(--btl-accent, rgb(250,204,21)); }
 .btl-text-accent { color: var(--btl-accent, rgb(250,204,21)); }

 d) Replace hardcoded Tailwind yellow classes in JSX:

 ┌───────────────────────────────────────────┬─────────────────────────────────────────────────────┐
 │                  Current                  │                    Replace with                     │
 ├───────────────────────────────────────────┼─────────────────────────────────────────────────────┤
 │ Header pulsing dot bg-yellow-400          │ add btl-dot class, remove bg-yellow-400             │
 │ animate-pulse                             │                                                     │
 ├───────────────────────────────────────────┼─────────────────────────────────────────────────────┤
 │ Header bars bg-yellow-400/40              │ inline style={{ backgroundColor:                    │
 │                                           │ 'var(--btl-accent)', opacity: 0.4 }}                │
 ├───────────────────────────────────────────┼─────────────────────────────────────────────────────┤
 │ Active annotation card                    │ conditional btl-ann-active class                    │
 │ bg-yellow-400/[0.08] border-yellow-400/40 │                                                     │
 ├───────────────────────────────────────────┼─────────────────────────────────────────────────────┤
 │ Annotation fragment label                 │                                                     │
 │ text-yellow-600/60                        │ class btl-text-accent opacity-60                    │
 │ dark:text-yellow-400/40                   │                                                     │
 ├───────────────────────────────────────────┼─────────────────────────────────────────────────────┤
 │ Active annotation badge bg-yellow-400     │ class btl-badge-active                              │
 │ text-black                                │                                                     │
 ├───────────────────────────────────────────┼─────────────────────────────────────────────────────┤
 │ Inactive annotation badge                 │ class btl-badge-inactive                            │
 │ bg-yellow-400/10 text-yellow-600          │                                                     │
 ├───────────────────────────────────────────┼─────────────────────────────────────────────────────┤
 │ Lyric annotation dot bg-yellow-400        │ class btl-dot or inline style                       │
 │ (active) + bg-yellow-400/40 (hint)        │                                                     │
 ├───────────────────────────────────────────┼─────────────────────────────────────────────────────┤
 │ shadow-[0_0_10px_rgba(250,204,21,0.8)] on │ inline style boxShadow: \0 0 10px                   │
 │  dot                                      │ ${palette.accentSoft.replace('0.12','0.8')}`` or    │
 │                                           │ remove shadow                                       │
 ├───────────────────────────────────────────┼─────────────────────────────────────────────────────┤
 │ text-yellow-500 hover on Genius link      │ keep as-is (minor, hover state is hard to override) │
 └───────────────────────────────────────────┴─────────────────────────────────────────────────────┘

 The existing conic-gradient animation effect is preserved entirely — only the color changes to follow
 the album.

 ---
 Task 2: Mobile Floating Popover

 Mobile detection in SpotifyGeniusLiveCard.tsx

 const [isMobile, setIsMobile] = useState(false)
 useEffect(() => {
   const check = () => setIsMobile(window.innerWidth < 1024)
   check()
   window.addEventListener('resize', check)
   return () => window.removeEventListener('resize', check)
 }, [])

 New state for mobile popover

 const [mobilePopPos, setMobilePopPos] = useState<{ x: number; y: number } | null>(null)

 Lyric click handler (mobile branch)

 In the lyric line's onClick:
 onClick={(e) => {
   if (associatedAnn) {
     e.stopPropagation()
     const newId = fixedAnnId === associatedAnn.id ? null : associatedAnn.id
     setFixedAnnId(newId)
     if (isMobile && newId) {
       setMobilePopPos({ x: e.clientX, y: e.clientY })
     } else {
       setMobilePopPos(null)
     }
   }
 }}

 Container's existing onClick={() => setFixedAnnId(null)} also clears mobilePopPos:
 onClick={() => { setFixedAnnId(null); setMobilePopPos(null) }}

 Hide right panel on mobile

 Change the right annotations panel wrapper:
 // before: always rendered
 // after:
 <div className="hidden lg:flex lg:flex-col ... ">

 New MobileAnnotationPopover sub-component (inline in file)

 function MobileAnnotationPopover({ ann, pos, palette, onClose }: {
   ann: GeniusAnnotation
   pos: { x: number; y: number }
   palette: AlbumPalette
   onClose: () => void
 }) {
   const ref = useRef<HTMLDivElement>(null)
   const [coords, setCoords] = useState({ left: 0, top: 0 })

   useLayoutEffect(() => {
     const pw = Math.min(window.innerWidth - 32, 360)
     const ph = ref.current?.offsetHeight ?? 200
     let left = pos.x - pw / 2
     let top = pos.y + 16
     left = Math.max(16, Math.min(left, window.innerWidth - pw - 16))
     if (top + ph > window.innerHeight - 16) top = pos.y - ph - 16
     top = Math.max(16, top)
     setCoords({ left, top })
   }, [pos])

   return (
     <div
       ref={ref}
       style={{
         position: 'fixed',
         left: coords.left,
         top: coords.top,
         width: Math.min(window.innerWidth - 32, 360),
         zIndex: 50,
         // ...styling
       }}
       onClick={(e) => e.stopPropagation()}
     >
       {/* annotation content */}
       <button onClick={onClose}>✕</button>
       {ann.fragment && <p>"{ann.fragment}"</p>}
       <p>{ann.body}</p>
     </div>
   )
 }

 Rendered at the bottom of GeniusCardInner return:
 {isMobile && fixedAnnId && mobilePopPos && (() => {
   const ann = geniusData?.annotations.find(a => a.id === fixedAnnId)
   return ann ? (
     <MobileAnnotationPopover
       ann={ann}
       pos={mobilePopPos}
       palette={palette}
       onClose={() => { setFixedAnnId(null); setMobilePopPos(null) }}
     />
   ) : null
 })()}

 The popover styling follows the same btl-* CSS vars for border and accent colors.

 ---
 Critical Files

 ┌──────────────────────────────────────────────┬───────────────────────────────────────────────────┐
 │                     File                     │                      Action                       │
 ├──────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ components/spotify/SpotifyGeniusLiveCard.tsx │ Main changes — color vars, mobile popover, panel  │
 │                                              │ visibility                                        │
 ├──────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ hooks/useAlbumPalette.ts                     │ New file — canvas-based color extraction          │
 └──────────────────────────────────────────────┴───────────────────────────────────────────────────┘

 Reference only (do not modify):
 - ClaudeDesign/player/utils/colorExtractor.ts — algorithm source
 - ClaudeDesign/lyrics-card/components/BehindTheLyrics/Popover.tsx — viewport clamping logic
 - ClaudeDesign/lyrics-card/components/BehindTheLyrics/lyrics.module.css — CSS var patterns

 ---
 Verification

     - ClaudeDesign/lyrics-card/components/BehindTheLyrics/lyrics.module.css — CSS var patterns
                                                                                                      
     ---                                                
     Verification                                                                       
                                                                                                    
     1. npm run dev — open the Spotify page
     2. Color test: With a song playing, inspect the card — the conic-gradient marker color on  
     hover/click should match the album cover's dominant saturated color                               
     3. Fallback test: Pause or load with no album image — colors should fall back to yellow
     4. PC test: Right annotations panel still visible, hover/click lyric highlights annotation card and
      vice versa                                                                                        
     5. Mobile test (resize to < 1024px): Right panel hidden; tapping annotated lyric shows floating
     popover near tap position; popover stays within screen bounds; tapping outside dismisses it;
     tapping ✕ also dismisses
     6. Song change: Switch tracks — palette should update to new album's colors