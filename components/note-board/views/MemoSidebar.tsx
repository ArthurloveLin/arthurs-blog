// Barrel for the memo sidebar sections — implementation lives in ./sidebar/.
// Split from a single 1000-line file; each section is independently editable.

export { SidebarCalendar, type SidebarCalendarProps } from './sidebar/SidebarCalendar'
export { SidebarAgendaCalendar, type SidebarAgendaCalendarProps } from './sidebar/SidebarAgendaCalendar'
export { SidebarHabitHistory, type SidebarHabitHistoryProps } from './sidebar/SidebarHabitHistory'
export { SidebarTagCloud } from './sidebar/SidebarTagCloud'
export { SIDEBAR_MODE_ICONS, CHIP_COLORS, getTagColor, type SidebarModeEntry } from './sidebar/SidebarShared'
