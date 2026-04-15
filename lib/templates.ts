// lib/templates.ts

export interface Dimension {
  key: string
  label: string
  color: string
}

export interface TemplateConfig {
  name: string
  itemLabel: string
  dimensions: Dimension[]
  icon?: string // Lucide icon name
  descLabels?: {
    buy: string
    skip: string
    pending: string
  }
  // UX Refinements
  titlePlaceholder?: string
  notePlaceholder?: string
  itemNotePlaceholder?: string
  priceLabel?: string
}

export const TEMPLATES: Record<string, TemplateConfig> = {
  wardrobe: {
    name: '衣评',
    itemLabel: '衣服',
    dimensions: [
      { key: 'appearance_score', label: '颜值', color: '#f472b6' },
      { key: 'practicality_score', label: '实用', color: '#60a5fa' },
      { key: 'value_score', label: '性价比', color: '#34d399' },
    ],
    icon: 'Shirt',
    descLabels: { buy: '买', skip: '不买', pending: '待定' },
    titlePlaceholder: '例如：2025年5月选购',
    notePlaceholder: '可选，记录该次穿衣搭配的整体思路...',
    itemNotePlaceholder: '品牌、尺码、颜色、面料、链接等商品信息...',
    priceLabel: '价格',
  },
  food: {
    name: '美食',
    itemLabel: '美食',
    dimensions: [
      { key: 'taste_score', label: '味道', color: '#f59e0b' },
      { key: 'environment_score', label: '环境', color: '#10b981' },
      { key: 'service_score', label: '服务', color: '#3b82f6' },
      { key: 'value_score', label: '性价比', color: '#ef4444' },
    ],
    icon: 'Utensils',
    descLabels: { buy: '想吃', skip: '不想吃', pending: '看看' },
    titlePlaceholder: '例如：五一假期寻味之旅',
    notePlaceholder: '记录餐厅整体评价、人均价格、订位建议等...',
    itemNotePlaceholder: '招牌推荐、口感评价、避雷建议等...',
    priceLabel: '人均',
  },
  attraction: {
    name: '打卡',
    itemLabel: '景点',
    dimensions: [
      { key: 'scenery_score', label: '风景', color: '#10b981' },
      { key: 'comfort_score', label: '体验', color: '#60a5fa' },
      { key: 'crowd_score', label: '拥挤', color: '#f472b6' },
      { key: 'cost_score', label: '价格', color: '#34d399' },
    ],
    icon: 'MapPin',
    descLabels: { buy: '想去', skip: '不想去', pending: '看看' },
    titlePlaceholder: '例如：川西环线摄影计划',
    notePlaceholder: '记录行程安排、注意事项、最佳季节等...',
    itemNotePlaceholder: '最佳拍摄点、门票价格、避雷提示等...',
    priceLabel: '门票',
  },
  custom: {
    name: '通用',
    itemLabel: '项目',
    dimensions: [
      { key: 'dim_1', label: '维度一', color: '#94a3b8' },
      { key: 'dim_2', label: '维度二', color: '#64748b' },
      { key: 'dim_3', label: '维度三', color: '#475569' },
    ],
    icon: 'Layers',
    descLabels: { buy: '优选', skip: '排除', pending: '待定' },
    titlePlaceholder: '例如：周末探店评价',
    notePlaceholder: '记录该会话的背景信息...',
    itemNotePlaceholder: '记录该项目的详细情况、优缺点等...',
    priceLabel: '价格',
  },
}

export const DEFAULT_TEMPLATE = 'wardrobe'
