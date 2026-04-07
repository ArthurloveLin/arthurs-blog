import type { ExoticComponent, ReactNode } from "react";

declare module "react" {
  interface UnstableViewTransitionProps {
    children?: ReactNode;
    name?: "auto" | (string & {});
    default?: string;
    enter?: string;
    exit?: string;
    share?: string;
    update?: string;
  }

  // Next.js ships its own React build that exports these with `unstable_` prefix
  const unstable_ViewTransition: ExoticComponent<UnstableViewTransitionProps>;
  function unstable_addTransitionType(type: string): void;
}
