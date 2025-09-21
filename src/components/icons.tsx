import type { SVGProps } from "react";

export function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M10 2h4" />
      <path d="M12 2v6" />
      <path d="M21.17 8.83a4 4 0 0 0-5.66-5.66" />
      <path d="M17 8.01h-6" />
      <path d="M12.83 21.17a4 4 0 0 0 5.66-5.66" />
      <path d="M11 16h6" />
      <path d="M2.83 15.17a4 4 0 0 0 5.66 5.66" />
      <path d="M7 16h6" />
    </svg>
  );
}
