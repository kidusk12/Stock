import { t } from '../i18n/temp'

export default function Placeholder({ titleKey }) {
  return <h1 className="text-2xl font-semibold">{t(titleKey)}</h1>
}