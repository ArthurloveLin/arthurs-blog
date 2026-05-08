export interface RecipeHeroCopy {
  subtitle: string
  titleHighlight: string
  titleHighlight2: string
  titleRest: string
  description: string
  slogan1: string
  slogan2: string
}

export interface RecipePageCopy {
  hero: RecipeHeroCopy
}

export const RECIPE_SITE_CONFIG_DEFAULTS: Record<string, string> = {
  recipe_hero_subtitle: '私人档案',
  recipe_hero_title_highlight: 'Recipe',
  recipe_hero_title_highlight_2: '',
  recipe_hero_title_rest: '',
  recipe_hero_description: '长期维护的烹饪记录：食材、步骤、风味、技能树，像翻一本书一样回看每道菜的演进。',
  recipe_slogan_1: 'Every dish is an experiment',
  recipe_slogan_2: 'Every modification is growth',
}

export const RECIPE_SITE_CONFIG_KEYS = Object.keys(RECIPE_SITE_CONFIG_DEFAULTS)

function resolveCopyValue(config: Record<string, string>, key: string) {
  return config[key] || RECIPE_SITE_CONFIG_DEFAULTS[key] || ''
}

export function getRecipePageCopy(config: Record<string, string>): RecipePageCopy {
  return {
    hero: {
      subtitle: resolveCopyValue(config, 'recipe_hero_subtitle'),
      titleHighlight: resolveCopyValue(config, 'recipe_hero_title_highlight'),
      titleHighlight2: resolveCopyValue(config, 'recipe_hero_title_highlight_2'),
      titleRest: resolveCopyValue(config, 'recipe_hero_title_rest'),
      description: resolveCopyValue(config, 'recipe_hero_description'),
      slogan1: resolveCopyValue(config, 'recipe_slogan_1'),
      slogan2: resolveCopyValue(config, 'recipe_slogan_2'),
    },
  }
}
