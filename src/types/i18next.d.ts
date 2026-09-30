import { defaultNS } from '@/lib/i18n';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    // NOTE: strict `resources` typing was removed because hundreds of
    // call sites use unprefixed keys with useTranslation('<ns>'), which
    // the strict key union rejects. Loosening keeps t() accepting any key.
  }
}
