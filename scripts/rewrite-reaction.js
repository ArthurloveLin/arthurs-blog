const fs = require('fs');

let content = fs.readFileSync('components/ReactionToggleBar.tsx', 'utf8');

// The replacement code for LikeReactionGlyph
const newCode = `
import gsap from 'gsap'

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

  useEffect(() => {
    if (mode === 'like') {
      const tl = gsap.timeline({ onComplete: () => { gsap.set(\`#pinkHeart-\${cssId}\`, { clearProps: 'all' }) } });
      tl.timeScale(4);
      tl.fromTo(\`#pinkDot-\${cssId}\`, { attr: { r: 0 } }, { duration: 1, attr: { r: 66 } })
        .set(\`#greyHeart-\${cssId}\`, { scale: 0, transformOrigin: '50% 100%' }, '-=0.99')
        .to(\`#pinkDot-\${cssId}\`, { duration: 1, fill: '#CD8FF7' }, '-=1')
        .to(\`#hole-\${cssId}\`, { duration: 1, attr: { r: 67 } }, '-=0.5')
        .fromTo(\`#pinkHeart-\${cssId}\`, { scale: 0 }, { duration: 1.6, scale: 1, transformOrigin: '50% 50%', ease: 'back.out(1.2)' }, '-=0.5')
        .set([\`#sparkleGrowGroup-\${cssId}\`, \`#sparkleMoveGroup-\${cssId}\`], { opacity: 1 }, '-=1.5')
        .to(\`#sparkleGrowGroup-\${cssId}\`, { duration: 1, scale: 1.5, transformOrigin: '50% 50%' }, '-=1.5')
        .to(\`#sparkleMoveGroup-\${cssId}\`, { duration: 1, scale: 1.2, transformOrigin: '50% 50%' }, '-=1.5')
        .to(\`#sparkleGrowGroup-\${cssId} circle\`, { duration: 2, attr: { r: 0 }, stagger: 0, fill: i => sparkleGrowColors[i] }, '-=0.9')
        .to(\`#sparkleMoveGroup-\${cssId} circle\`, { duration: 0.8, attr: { r: 0 }, stagger: 0, fill: i => sparkleMoveColors[i] }, '-=2')
    } else if (mode === 'unlike') {
      const tl = gsap.timeline();
      tl.timeScale(4);
      tl.set(\`#brokenHeartGroup-\${cssId}\`, { opacity: 1 })
        .set(\`#pinkHeart-\${cssId}\`, { opacity: 0 })
        .fromTo([\`#breakLineL-\${cssId}\`, \`#breakLineR-\${cssId}\`], 
           { strokeDasharray: '52', strokeDashoffset: '52' }, 
           { duration: 3, strokeDashoffset: '0' })
        .to(\`#brokenHeartL-\${cssId}\`, { duration: 4, rotation: -90, transformOrigin: '110% 100%', ease: 'power2.in' }, '-=1.5')
        .to(\`#brokenHeartR-\${cssId}\`, { duration: 4, rotation: 90, transformOrigin: '10% 100%', ease: 'power2.in' }, '-=4')
        .to(\`#greyHeart-\${cssId}\`, { duration: 3, scale: 1, ease: 'power4.inOut' }, '-=1.6')
        .set([\`#breakLineL-\${cssId}\`, \`#breakLineR-\${cssId}\`], { opacity: 0 }, '-=3')
        .to([\`#brokenHeartL-\${cssId}\`, \`#brokenHeartR-\${cssId}\`], { duration: 0.3, opacity: 0 }, '-=2')
    } else {
      // Idle state
      if (active) {
        gsap.set(\`#pinkHeart-\${cssId}\`, { scale: 1, opacity: 1 });
        gsap.set(\`#greyHeart-\${cssId}\`, { scale: 0 });
      } else {
        gsap.set(\`#pinkHeart-\${cssId}\`, { scale: 0, opacity: 0 });
        gsap.set(\`#greyHeart-\${cssId}\`, { scale: 1, opacity: 1 });
      }
      gsap.set(\`#brokenHeartGroup-\${cssId}\`, { opacity: 0 });
      gsap.set([\`#sparkleGrowGroup-\${cssId}\`, \`#sparkleMoveGroup-\${cssId}\`], { opacity: 0 });
      gsap.set(\`#hole-\${cssId}\`, { attr: { r: 0 } });
      gsap.set(\`#pinkDot-\${cssId}\`, { attr: { r: 0 }, fill: '#E52951' });
    }
  }, [mode, active, cssId, animationKey]);

  return (
    <span
      key={\`like-\${mode}-\${animationKey}-\${active ? 'active' : 'idle'}\`} /* keeping original key behavior so it runs correctly when replaced? Wait, if we keep key, the DOM destroys, which is exactly why the useEffect runs perfectly. */
      className={[
        'reaction-glyph reaction-glyph--like',
        compact ? 'reaction-glyph--compact' : '',
        emphasis === 'hero' ? 'reaction-glyph--hero' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <svg viewBox="0 0 600 600" className="reaction-glyph__svg block w-full h-full">
        <defs>
          <mask id={cssId}>
            <circle id={\`whiteDot-\${cssId}\`} fill="#FFFFFF" cx="300" cy="300.5" r="66"/>
            <circle id={\`hole-\${cssId}\`} cx="300" cy="300.5" r="0"/>    
          </mask>
          <path id={\`heartDef-\${cssId}\`} d="M318.2,259.5c-7.5,0-14.2,3.7-18.2,9.5c-4-5.7-10.7-9.5-18.2-9.5
          c-12.3,0-22.3,10-22.3,22.3c0,30.4,31.6,58.7,40.5,58.7s40.5-28.4,40.5-58.7C340.5,269.5,330.5,259.5,318.2,259.5z"/>  
        </defs>
        
        <use id={\`greyHeart-\${cssId}\`} href={\`#heartDef-\${cssId}\`} fill="#AAB8C2"/> 
        <use id={\`pinkHeart-\${cssId}\`} href={\`#heartDef-\${cssId}\`} fill="#E2264D" style={{ opacity: active ? 1 : 0, scale: active ? 1 : 0, transformOrigin: '50% 50%' }} /> 

        <g mask={\`url(#\${cssId})\`}>
          <circle id={\`pinkDot-\${cssId}\`} fill="#E52951" cx="300" cy="300.5" r="66" style={{ r: 0 }} />
        </g>
        <g id={\`sparkleGrowGroup-\${cssId}\`} opacity="0">
          <circle fill="#91D1F9" cx="310.7" cy="239" r="5"/>
          <circle fill="#91D1F9" cx="235.7" cy="305" r="5"/>
          <circle fill="#8CE9C4" cx="254.7" cy="252" r="5"/>
          <circle fill="#8CE9C4" cx="359.7" cy="322" r="5"/>
          <circle fill="#F48DA6" cx="332.7" cy="361" r="5"/>
          <circle fill="#CB8EF4" cx="357.7" cy="267" r="5"/>
          <circle fill="#91D1F9" cx="273.7" cy="363" r="5"/>
        </g> 
        <g id={\`sparkleMoveGroup-\${cssId}\`} opacity="0">
          <circle fill="#91D1F9" cx="300.7" cy="229" r="5"/>
          <circle fill="#91D1F9" cx="263.7" cy="353" r="5"/>
          <circle fill="#8CE9C4" cx="243.7" cy="257" r="5"/>
          <circle fill="#8CE9C4" cx="367.7" cy="312" r="5"/>
          <circle fill="#F48DA6" cx="320.7" cy="353" r="5"/>
          <circle fill="#CB8EF4" cx="233.7" cy="317" r="5"/>
          <circle fill="#CB8EF4" cx="353.7" cy="255" r="5"/>
        </g> 
        <g id={\`brokenHeartGroup-\${cssId}\`} opacity="0">
          <path id={\`brokenHeartR-\${cssId}\`} fill="#E2264D" d="M299.9,340.5c8.9,0,40.5-28.4,40.5-58.7c0-12.3-10-22.3-22.3-22.3
            c-7.5,0-14.2,3.7-18.2,9.5l4,7.3l-11.8,15.5l11.3,11.3l-7.8,12.8l7.3,9l-4,6.7L300,340.5z"/>
          <path id={\`brokenHeartL-\${cssId}\`} fill="#E2264D" d="M300.1,269c-4-5.7-10.7-9.5-18.2-9.5c-12.3,0-22.3,10-22.3,22.3
            c0,30.4,31.6,58.7,40.5,58.7l-1-9l4-6.7l-7.3-9l7.8-12.8l-11.3-11.3l11.8-15.5L300,269z"/>  
          <path id={\`breakLineL-\${cssId}\`} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeMiterlimit="10" d="M300,340.5l-1-9l4-6.7l-7.3-9
            l7.8-12.8l-11.3-11.3l11.8-15.5l-4-7.3"/>
          <path id={\`breakLineR-\${cssId}\`} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeMiterlimit="10" d="M300,340.5l-1-9l4-6.7l-7.3-9
            l7.8-12.8l-11.3-11.3l11.8-15.5l-4-7.3"/>
        </g>  
      </svg>
    </span>
  )
}
`

// Regex or replace to swap it out
let newContent = content.replace(
  /type LikeAnimationMode = 'idle' \| 'like' \| 'unlike'[\s\S]*?function DislikeReactionGlyph/m,
  newCode + '\nfunction DislikeReactionGlyph'
);

fs.writeFileSync('components/ReactionToggleBar.tsx', newContent);
console.log('Replaced LikeReactionGlyph.');
