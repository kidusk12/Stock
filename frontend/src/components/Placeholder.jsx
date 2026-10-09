import { useTranslation } from 'react-i18next'

export default function Placeholder({ titleKey }) {
  const { t } = useTranslation()
  return <h1 className="text-2xl font-semibold">{t(titleKey)}</h1>
}