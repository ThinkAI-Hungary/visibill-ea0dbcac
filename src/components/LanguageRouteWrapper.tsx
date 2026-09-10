import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface LanguageRouteWrapperProps {
  language: 'hu' | 'hr';
}

/**
 * Route wrapper that ensures the i18n language matches the URL route prefix.
 */
export const LanguageRouteWrapper: React.FC<LanguageRouteWrapperProps> = ({ language }) => {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  return <Outlet />;
};
