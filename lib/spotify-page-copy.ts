export interface SpotifyHeroCopy {
  subtitle: string
  titleHighlight: string
  titleHighlight2: string
  titleRest: string
  description: string
  slogan1: string
  slogan2: string
}

export interface SpotifySectionCopy {
  eyebrow: string
  title: string
  description: string
}

export interface SpotifyPageCopy {
  hero: SpotifyHeroCopy
  recent: SpotifySectionCopy
  report: SpotifySectionCopy
  topArtists: SpotifySectionCopy
  savedAlbums: SpotifySectionCopy
  topTracks: SpotifySectionCopy
  savedTracks: SpotifySectionCopy
  tagCloud: SpotifySectionCopy
  tagRadar: SpotifySectionCopy
  playlists: SpotifySectionCopy
  warnings: SpotifySectionCopy
}

export const SPOTIFY_SITE_CONFIG_DEFAULTS: Record<string, string> = {
  spotify_hero_subtitle: 'SOUNDTRACK ARCHIVE',
  spotify_hero_title_highlight: 'Music',
  spotify_hero_title_highlight_2: '',
  spotify_hero_title_rest: 'Archive',
  spotify_hero_description: '把最近循环、收藏与反复重播的旋律整理成一页可翻阅的音乐日记，记录每个阶段的情绪、偏爱与回声。',
  spotify_slogan_1: 'Some days stay with us',
  spotify_slogan_2: 'because the right song was there.',
  spotify_recent_eyebrow: 'Recently Played',
  spotify_recent_title: '最近听歌',
  spotify_recent_description: '按一周时间轴回看播放痕迹，看看从清晨到深夜，哪几首歌反复陪你走过一天。',
  spotify_report_eyebrow: 'Music Report',
  spotify_report_title: '听歌报告',
  spotify_report_description: '把今天、本周和本月的偏好压成四张纸本海报，一眼看见主打单曲、常驻歌手与情绪走向。',
  spotify_top_artists_eyebrow: 'Top Artists',
  spotify_top_artists_title: '常听歌手',
  spotify_top_artists_description: '收听频率会慢慢写出一份稳定的歌手名单，这里保留的是每个阶段最常回访的名字。',
  spotify_saved_albums_eyebrow: 'Saved Albums',
  spotify_saved_albums_title: '收藏专辑',
  spotify_saved_albums_description: '把想反复回味的整张唱片留在这里，顺着封面继续翻看最近认真收进库里的专辑。',
  spotify_top_tracks_eyebrow: 'Top Tracks',
  spotify_top_tracks_title: '单曲热榜',
  spotify_top_tracks_description: '按时间范围回看最常播放的 50 首歌，封面墙往往比列表更快暴露阶段性的偏爱。',
  spotify_saved_tracks_eyebrow: 'Library Data',
  spotify_saved_tracks_title: '点赞歌曲',
  spotify_saved_tracks_description: '这里是随手点亮的小收藏，既有一听上头的即时喜欢，也有反复验证过的长期保留。',
  spotify_tag_cloud_eyebrow: 'Tag Cloud',
  spotify_tag_cloud_title: '音乐标签画像',
  spotify_tag_cloud_description: '把标签热度摊开成一朵词云，能更直观看出最近偏向哪类声音、情绪和氛围。',
  spotify_tag_radar_eyebrow: 'Radar Chart',
  spotify_tag_radar_title: '音乐风格雷达',
  spotify_tag_radar_description: '把标签聚类压成一张风格雷达图，看看最近的听感重心，究竟更靠近哪里。',
  spotify_playlists_eyebrow: 'Playlists',
  spotify_playlists_title: '歌单收藏',
  spotify_playlists_description: '把自己留下的，以及平台推荐后仍愿意保存的歌单，集中陈列在这一页里。',
  spotify_warnings_eyebrow: 'Data Warnings',
  spotify_warnings_title: '同步提示',
  spotify_warnings_description: '如果某些 Spotify 数据暂时缺席，这里会明确标出当前的降级项，不让页面默默失声。',
}

export const SPOTIFY_SITE_CONFIG_KEYS = Object.keys(SPOTIFY_SITE_CONFIG_DEFAULTS)

function resolveCopyValue(config: Record<string, string>, key: string) {
  return config[key] || SPOTIFY_SITE_CONFIG_DEFAULTS[key] || ''
}

function resolveSectionCopy(config: Record<string, string>, prefix: string): SpotifySectionCopy {
  return {
    eyebrow: resolveCopyValue(config, `${prefix}_eyebrow`),
    title: resolveCopyValue(config, `${prefix}_title`),
    description: resolveCopyValue(config, `${prefix}_description`),
  }
}

export function getSpotifyPageCopy(config: Record<string, string>): SpotifyPageCopy {
  return {
    hero: {
      subtitle: resolveCopyValue(config, 'spotify_hero_subtitle'),
      titleHighlight: resolveCopyValue(config, 'spotify_hero_title_highlight'),
      titleHighlight2: resolveCopyValue(config, 'spotify_hero_title_highlight_2'),
      titleRest: resolveCopyValue(config, 'spotify_hero_title_rest'),
      description: resolveCopyValue(config, 'spotify_hero_description'),
      slogan1: resolveCopyValue(config, 'spotify_slogan_1'),
      slogan2: resolveCopyValue(config, 'spotify_slogan_2'),
    },
    recent: resolveSectionCopy(config, 'spotify_recent'),
    report: resolveSectionCopy(config, 'spotify_report'),
    topArtists: resolveSectionCopy(config, 'spotify_top_artists'),
    savedAlbums: resolveSectionCopy(config, 'spotify_saved_albums'),
    topTracks: resolveSectionCopy(config, 'spotify_top_tracks'),
    savedTracks: resolveSectionCopy(config, 'spotify_saved_tracks'),
    tagCloud: resolveSectionCopy(config, 'spotify_tag_cloud'),
    tagRadar: resolveSectionCopy(config, 'spotify_tag_radar'),
    playlists: resolveSectionCopy(config, 'spotify_playlists'),
    warnings: resolveSectionCopy(config, 'spotify_warnings'),
  }
}
