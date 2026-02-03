import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component that scrolls to top on route changes
 * and persists the current route for navigation restoration
 */
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    
    // Store current route for navigation persistence (excluding login)
    if (pathname !== '/login') {
      localStorage.setItem('lastRoute', pathname);
    }
  }, [pathname]);

  return null;
};

export default ScrollToTop;
