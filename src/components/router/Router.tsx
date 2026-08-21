import { useEffect, useState, type MouseEvent, type ReactNode, type AnchorHTMLAttributes } from 'react';
import { classNames } from '@/utils/format';

function getHashPath(): string {
  let hash = window.location.hash;
  if (!hash) return '/';
  if (hash.startsWith('#')) {
    hash = hash.slice(1);
  }
  if (!hash.startsWith('/')) {
    hash = '/' + hash;
  }
  return hash;
}

export function navigate(path: string) {
  let cleanPath = path;
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  window.location.hash = cleanPath;
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
  const cleanPath = path.split('?')[0];
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = cleanPath.split('/').filter(Boolean);
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
  const current = getHashPath().split('?')[0];
  const targetClean = to.split('?')[0];
  const isActive = current === targetClean || (targetClean !== '/' && current.startsWith(targetClean));

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    navigate(to);
    onClick?.(e);
  }

  return (
    <a
      href={`#${to.startsWith('/') ? to : '/' + to}`}
      onClick={handleClick}
      className={classNames(className, isActive && activeClass)}
      {...props}
    >
      {children}
    </a>
  );
}