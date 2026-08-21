import { useEffect, useState, type MouseEvent, type ReactNode, type AnchorHTMLAttributes } from 'react';
import { classNames } from '@/utils/format';

function getHashPath(): string {
  const hash = window.location.hash.slice(1);
  return hash || '/';
}

export function navigate(path: string) {
  window.location.hash = path;
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

export function useRoute(): string {
  const [path, setPath] = useState(getHashPath());

  useEffect(() => {
    const onChange = () => {
      setPath(getHashPath());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return path;
}

export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
  activeClass?: string;
}

export function Link({ to, children, className, activeClass, onClick, ...props }: LinkProps) {
  const current = getHashPath();
  const isActive = current === to || (to !== '/' && current.startsWith(to));

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    navigate(to);
    onClick?.(e);
  }

  return (
    <a
      href={`#${to}`}
      onClick={handleClick}
      className={classNames(className, isActive && activeClass)}
      {...props}
    >
      {children}
    </a>
  );
}
