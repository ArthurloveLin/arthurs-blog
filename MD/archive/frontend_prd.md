# Role & Objective
You are an Expert Frontend Architect and UI/UX Designer. Your task is to refactor a blog frontend using **Next.js (App Router)** and **Tailwind CSS**. You will follow a strict "AppleUI / Soft Card" design system and a 3-column layout based on a provided PRD. 

# Execution Rules (CRITICAL)
This is a complex task. You MUST execute this step-by-step. 
**After completing each Phase, you must STOP, present the code/results, and ask: "Shall I proceed to the next phase?"** Do not move to the next phase until I give you permission.

---

# Design System: AppleUI / Soft Card
Please implement these specific Tailwind configurations and classes throughout the project:
- **Global Background:** Light, cool gray `bg-[#F5F5F7]`.
- **Card Styling:** Pure white backgrounds `bg-white`, large border radius `rounded-2xl` or `rounded-3xl`.
- **Soft Shadows (Drop Shadow):** Use a highly diffused, soft shadow: `shadow-[0_8px_30px_rgb(0,0,0,0.04)]`.
- **Hover Interactions:** Subtly lift the cards and deepen the shadow: `transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]`.
- **Typography:** - Primary Text (Headings/Titles): Deep black `text-[#1D1D1F]`.
  - Secondary Text (Dates/Metadata/Excerpts): Soft gray `text-[#86868B]`.
  - Font: San Francisco (system-ui) or Inter.
- **Glassmorphism (for Header):** `bg-white/70 backdrop-blur-xl border-b border-gray-200/50`.

---

# Product Requirements Document (PRD) & Step-by-Step Plan

## Phase 1: Foundation & Layout Container
1. Initialize the root layout (`app/layout.tsx`) setting the global background color to `#F5F5F7`.
2. Create a main wrapper container that centers the content: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8`.
3. Set up mock data arrays (Posts, Categories, Tags) in a separate file so components can render real-looking data.

## Phase 2: The Glassmorphism Header
1. Create a `Header` component sticky at the top (`sticky top-0 z-50`).
2. Apply the Glassmorphism effect described in the Design System.
3. **Structure:** - Left: Blog Logo/Title (`text-[#1D1D1F] font-bold text-xl`).
   - Center: Navigation Links (Home, Archive, Tags, About) with subtle hover effects.
   - Right: Icons placeholder (RSS, Search, Theme Toggle).

## Phase 3: The 3-Column Grid System (Main Skeleton)
1. Inside the main container, create the grid structure.
2. **Desktop (`lg` and above):** `grid grid-cols-12 gap-6`.
   - Left Sidebar span: `col-span-3`
   - Main Feed span: `col-span-6`
   - Right Sidebar span: `col-span-3`
3. **Tablet (`md`):** `grid-cols-12 gap-6`. Left Sidebar (`col-span-4`), Main Feed (`col-span-8`). Hide or move the Right Sidebar below.
4. **Mobile (`sm`):** `grid-cols-1 flex flex-col`.

## Phase 4: Left Sidebar Components (Author & Meta)
Build the following separate components and place them in the Left Sidebar. Make the sidebar `sticky top-24`.
1. **AuthorProfileCard:**
   - Circular Avatar (placeholder image), centered.
   - Name (`text-lg font-semibold mt-4 text-center`).
   - Bio/Slogan (`text-sm text-[#86868B] text-center mb-4`).
   - Stats Flex Row: 3 items (Posts, Categories, Tags) with number (bold) and label (small).
2. **CategoriesCard:**
   - Title: "Categories".
   - List items with category name on the left and count badge on the right (e.g., `bg-gray-100 rounded-full px-2 py-0.5 text-xs`).
3. **TagsCloudCard:**
   - Title: "Tags".
   - Flex-wrap container with pill-shaped tags (`rounded-full bg-[#F5F5F7] px-3 py-1 text-sm text-[#1D1D1F]`).

## Phase 5: Main Content Feed (Blog Posts)
Build the `PostCard` component and render a list of them in the center column.
1. **PostCard:**
   - Implement the standard Card Styling (white, soft shadow, rounded-2xl).
   - Top: Placeholder Cover Image (full width, `h-48`, object-cover, top rounded corners).
   - Body Padding: `p-6`.
   - Title: Big, bold, `text-[#1D1D1F] mb-2`.
   - Excerpt: 2 lines maximum (`line-clamp-2`), `text-[#86868B] text-sm mb-4`.
   - Footer: Flex row containing Date and a "Read More" text button.

## Phase 6: Right Sidebar Components (Timeline & Archive)
Build these components for the Right Sidebar (also make it sticky):
1. **RecentPostsCard:**
   - Title: "Recent Posts".
   - List of 5 minimal items: Post title (clickable hover state) and date below it in small text.
2. **ArchiveCard:**
   - Title: "Archives".
   - List of Years (e.g., 2024, 2023) with post counts aligned to the right.

---
**Agent Instruction:** Please start with **Phase 1** only. Output the code for Phase 1, explain what you did, and ask if you should proceed to Phase 2.