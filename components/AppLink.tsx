import type { AnchorHTMLAttributes } from "react";

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};

/**
 * Vinext's beta client-navigation shim currently throws during both prefetch
 * and click transitions in the production bundle. A native anchor gives every
 * route reliable, progressively enhanced navigation until that shim is stable.
 */
export default function AppLink({ children, href, ...props }: AppLinkProps) {
  return <a {...props} href={href}>{children}</a>;
}
