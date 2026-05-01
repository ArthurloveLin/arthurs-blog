// data/track.ts
// Static demo data — replace with Genius API call in production.
// See DESIGN.md §八 for API integration notes.

import { Track, AnnotationMap } from '@/lib/types'

export const TRACK: Track = {
  title: 'drop dead',
  artist: 'Olivia Rodrigo',
  album: 'GUTS (spilled deluxe)',
  // Album-cover derived palette. In production, generate via /api/palette?coverUrl=...
  palette: {
    bg:         '#F4EFE6',
    bgDeep:     '#EAE2D2',
    paper:      '#FBF8F1',
    ink:        '#2A1F2C',
    ink2:       'rgba(42,31,44,.62)',
    ink3:       'rgba(42,31,44,.42)',
    accent:     '#7A4FB5',
    accentSoft: 'rgba(122,79,181,.14)',
    accent2:    '#C8689B',
    warm:       '#E8A14B',
    line:       'rgba(42,31,44,.10)',
  },
  sections: [
    {
      label: null,
      lines: [
        [
          { text: "And I know why he wrote them now that you're standin' " },
          { ref: 'r1', text: "right here" },
        ],
      ],
    },
    {
      label: 'Chorus',
      lines: [
        [{ ref: 'r2', text: "Oh, one night I was bored in bed" }],
        [{ text: "And " }, { ref: 'r3', text: "stalked you on the internet" }],
        [{ text: "It's " }, { ref: 'r4', text: "feminine intuition" }],
        [{ text: "'Cause I always had a vision of us " }, { ref: 'r5', text: "standing like this" }],
        [{ text: "All pressed up in the " }, { ref: 'r6', text: "bathroom line" }],
        [{ text: "You're lookin' like an angel on the " }, { ref: 'r7', text: "walls of Versailles" }],
        [{ ref: 'r8', text: "The most alive I've ever been" }],
      ],
    },
    {
      label: 'Verse 2',
      lines: [
        [{ text: "I'm gonna " }, { ref: 'r9', text: "drop dead" }, { text: " when you call me \"baby\"" }],
        [{ text: "Sweet talkin' me through " }, { ref: 'r10', text: "all my self-doubts" }],
        [{ text: "I think I might just go and lose it" }],
        [{ text: "If you ever, ever, " }, { ref: 'r11', text: "ever leave me out" }],
      ],
    },
  ],
}

export const ANNOTATIONS: AnnotationMap = {
  r1: {
    title: '"…now that you\'re standin\' right here"',
    quote: "And I know why he wrote them now that you're standin' right here",
    body: "Olivia is referencing the songs her current love interest wrote about a previous relationship. Now that she's in his presence, she finally understands the emotional weight behind every line — a meta nod to her own songwriting craft, where lived experience is always the source.",
    helpful: 124,
  },
  r2: {
    title: '"Oh, one night I was bored in bed"',
    quote: "one night I was bored in bed",
    body: "A characteristically Olivia opener — disarmingly mundane, almost diaristic. The 'bored in bed' framing strips any romance from what follows: this isn't a grand love story, it's a 2 AM rabbit hole that turned into something real.",
    helpful: 58,
  },
  r3: {
    title: '"…stalked you on the internet"',
    quote: "stalked you on the internet",
    body: "Olivia leans into the digital-native confession, common across her writing (see also: \"vampire\", \"lacy\"). The line lands as both confession and flex — Gen Z's version of the meet-cute, where infatuation begins on a phone screen long before it does in person.",
    helpful: 312,
  },
  r4: {
    title: '"feminine intuition"',
    quote: "It's feminine intuition",
    body: "A wink to the phrase's long pop-culture history — from country songs to romance novels — but recast as the justification for behavior that would otherwise read as unhinged. Olivia uses it to absolve herself: it isn't obsession, it's knowing.",
    helpful: 201,
  },
  r5: {
    title: '"…standing like this"',
    quote: "a vision of us standing like this",
    body: "Echoes Lana Del Rey's gauzy iconography and Taylor Swift's 'Enchanted'-era cinematic framing. The vision is positional, not narrative — she pictured the geometry of being next to him before she pictured the relationship.",
    helpful: 89,
  },
  r6: {
    title: '"…all pressed up in the bathroom line"',
    quote: "All pressed up in the bathroom line",
    body: "A specific, embodied image — the bathroom line at a house party or club is one of the most universally-coded 'girl spaces' in pop. Olivia plants the romance in a setting that's usually a punchline, treating it as sacred ground.",
    helpful: 167,
  },
  r7: {
    title: '"…walls of Versailles"',
    quote: "angel on the walls of Versailles",
    body: "The Hall of Mirrors / Versailles ceiling fresco reference puts the lover in a Baroque tableau — angels, gold, infinite reflection. The contrast with 'bathroom line' two lines earlier is deliberate: high and low, sublime and silly.",
    helpful: 433,
  },
  r8: {
    title: '"The most alive I\'ve ever been"',
    quote: "The most alive I've ever been",
    body: "The chorus' emotional payoff. After eight lines of detail — boredom, scrolling, parties, palaces — she names the feeling plainly. The simplicity is the device: a line you could embroider on a pillow, earned by the specificity around it.",
    helpful: 612,
  },
  r9: {
    title: '"I\'m gonna drop dead"',
    quote: 'I\'m gonna drop dead when you call me "baby"',
    body: "The title phrase. 'Drop dead' as a hyperbolic Gen Z swoon — the way 'I could die' became 'I'm literally deceased' online. Olivia has spoken about wanting the song to capture the physical-comedy of a crush, not the tragedy of one.",
    helpful: 521,
  },
  r10: {
    title: '"all my self-doubts"',
    quote: "Sweet talkin' me through all my self-doubts",
    body: "A reversal of the toxic-relationship register her earlier work was known for ('driver's license', 'vampire'). Here the lover is a stabilizer, not a destabilizer. Several reviewers have noted GUTS (spilled deluxe) marks a shift toward songs about feeling safe.",
    helpful: 78,
  },
  r11: {
    title: '"…ever leave me out"',
    quote: "If you ever, ever, ever leave me out",
    body: "The triple 'ever' is a structural callback to 'deja vu'. Olivia uses repetition to perform anxiety — the word loses meaning the more she says it, mimicking the spiral she's trying to articulate.",
    helpful: 94,
  },
}

/** Returns annotation refs in document order. */
export function getAnnotationOrder(track: Track): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const sec of track.sections) {
    for (const line of sec.lines) {
      for (const seg of line) {
        if (seg.ref && !seen.has(seg.ref)) {
          seen.add(seg.ref)
          out.push(seg.ref)
        }
      }
    }
  }
  return out
}
