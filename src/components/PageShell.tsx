import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  accent?: string; // CSS var
};

export function PageShell({ children, accent }: Props) {
  return (
    <main
      className="w-full max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-8 untap-page-in"
      style={accent ? ({ ["--accent" as string]: accent } as React.CSSProperties) : undefined}
    >
      {children}
    </main>
  );
}
