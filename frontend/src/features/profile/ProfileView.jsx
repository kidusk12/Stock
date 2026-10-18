import { useState, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import UserAvatar from '../../components/UserAvatar'
import {
  User,
  Mail,
  Phone,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Building2,
  KeyRound,
  Save,
  RotateCcw
} from 'lucide-react'

// Curated professional avatar presets matching system design
const AVATAR_PRESETS = [
  { id: 'avatar1', url: '/avatar.jpg', label: 'Classic Pro' },
  { id: 'avatar2', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80', label: 'Professional 1' },
  { id: 'avatar3', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80', label: 'Professional 2' },
  { id: 'avatar4', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80', label: 'Professional 3' },
]

export default function ProfileView() {
  const { user, updateProfile } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'
  const fileInputRef = useRef(null)

  // Clean initial English and Amharic names
  const defaultEnName = user?.fullName ? user.fullName.split('(')[0].trim() : 'Abebe Kebede'
  const defaultAmName = user?.fullNameAm || (user?.fullName?.includes('(') ? user.fullName.split('(')[1].replace(')', '').trim() : 'አበበ ከበደ')

  const [formData, setFormData] = useState({
    fullName: defaultEnName,
    fullNameAm: defaultAmName,
    email: user?.email || (user?.username ? `${user.username}@berhanstock.et` : 'admin@berhanstock.et'),
    phone: user?.phone || '+251 911 234567',
    avatarUrl: user?.avatarUrl || null,
  })

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordStatus, setPasswordStatus] = useState({ success: '', error: '' })

  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' })

  // Handle local image upload via FileReader
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setStatusMessage({
        type: 'error',
        text: isAm ? 'እባክዎ ትክክለኛ የፎቶ ፋይል ይምረጡ' : 'Please select a valid image file (JPG, PNG, WEBP)',
      })
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setStatusMessage({
        type: 'error',
        text: isAm ? 'የፎቶው መጠን ከ 2 ሜጋባይት ማነስ አለበት' : 'Image size must be less than 2MB',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (uploadEvent) => {
      const base64Url = uploadEvent.target?.result
      setFormData((prev) => ({ ...prev, avatarUrl: base64Url }))
      setStatusMessage({
        type: 'info',
        text: isAm ? 'ፎቶ ተመርጧል! ለማስቀመጥ "ለውጦችን አስቀምጥ" የሚለውን ይጫኑ።' : 'Picture selected! Click "Save Changes" to apply.',
      })
    }
    reader.readAsDataURL(file)
  }

  // Remove photo and revert back to first letter avatar
  const handleRemovePhoto = () => {
    setFormData((prev) => ({ ...prev, avatarUrl: null }))
    setStatusMessage({
      type: 'info',
      text: isAm
        ? 'ፎቶ ተወግዷል፤ የመገለጫ ፎቶው ወደ ስም መጀመሪያ ፊደል ይመለሳል።'
        : 'Photo removed; profile will display initial letter avatar.',
    })
  }

  // Save profile changes
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setStatusMessage({ type: '', text: '' })

    try {
      // Combined full name format if needed
      const compositeFullName = formData.fullNameAm
        ? `${formData.fullName} (${formData.fullNameAm})`
        : formData.fullName

      const payload = {
        fullName: formData.fullName,
        fullNameAm: formData.fullNameAm,
        compositeFullName,
        email: formData.email,
        phone: formData.phone,
        avatarUrl: formData.avatarUrl,
      }

      await api.patch('/auth/profile', payload).catch(() => {})

      // Update in AuthContext & LocalStorage in real-time
      updateProfile(payload)

      setStatusMessage({
        type: 'success',
        text: isAm ? 'መገለጫዎ በተሳካ ሁኔታ ተዘምኗል!' : 'Your profile has been updated successfully!',
      })
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || (isAm ? 'ማዘመን አልተሳካም' : 'Failed to update profile'),
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordStatus({ success: '', error: '' })

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordStatus({
        success: '',
        error: isAm ? 'አዲሱ የይለፍ ቃል አይዛመድም' : 'New passwords do not match',
      })
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordStatus({
        success: '',
        error: isAm ? 'የይለፍ ቃል ቢያንስ 6 ፊደላት መሆን አለበት' : 'Password must be at least 6 characters',
      })
      return
    }

    try {
      await api.post('/auth/change-password', passwordData)
      setPasswordStatus({
        success: isAm ? 'የይለፍ ቃል በተሳካ ሁኔታ ተቀይሯል!' : 'Password changed successfully!',
        error: '',
      })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setPasswordStatus({
        success: '',
        error: err.message || (isAm ? 'የይለፍ ቃል መቀየር አልተሳካም' : 'Error updating password'),
      })
    }
  }

  const initialLetter = (formData.fullName || user?.username || 'U').trim().charAt(0).toUpperCase()

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#15343f] tracking-tight">
          {isAm ? 'የመገለጫ ቅንብሮች' : 'Profile Settings'}
        </h1>
        <p className="text-xs text-[#728994] mt-1">
          {isAm
            ? 'የግል መረጃዎን፣ የመገለጫ ፎቶዎን እና የደህንነት ቅንብሮችን ያስተዳድሩ'
            : 'Manage your personal details, profile picture, and security preferences'}
        </p>
      </div>

      {/* Notifications / Alerts */}
      {statusMessage.text && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold ${
            statusMessage.type === 'success'
              ? 'bg-[#e3f2ec] text-[#1c6953] border border-[#c1e5d7]'
              : statusMessage.type === 'error'
              ? 'bg-[#fbece5] text-[#c66749] border border-[#f5d5c6]'
              : 'bg-[#e3ecf5] text-[#24586b] border border-[#cadbe2]'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#28846c]" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Avatar Customizer (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-[#cfdde3] p-6 shadow-clean text-center">
            <h2 className="text-xs font-bold text-[#15343f] uppercase tracking-wide mb-5 text-left">
              {isAm ? 'የመገለጫ ፎቶ' : 'Profile Picture'}
            </h2>

            {/* Avatar Preview */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative group">
                <UserAvatar
                  user={{ ...user, fullName: formData.fullName, avatarUrl: formData.avatarUrl }}
                  size="2xl"
                  className="shadow-md"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-[#173d4a] text-white flex items-center justify-center shadow-md hover:bg-[#12303a] transition"
                  title={isAm ? 'ፎቶ ቀይር' : 'Upload photo'}
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              {/* Status pill badge */}
              <div className="mt-4">
                {formData.avatarUrl ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#e3f2ec] text-[#1c6953]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isAm ? 'ብጁ ፎቶ ተመርጧል' : 'Custom photo active'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#edf3f6] text-[#4f7988]">
                    <span className="h-2 w-2 rounded-full bg-[#4f7988]" />
                    {isAm ? `የመጀመሪያ ፊደል: "${initialLetter}"` : `Initial Avatar: "${initialLetter}"`}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-[#728994] mt-2 max-w-xs">
                {isAm
                  ? 'ምንም ፎቶ ካልተመረጠ የመገለጫ ፎቶው በስምዎ መጀመሪያ ፊደል ላይ የተመሠረተ ይሆናል።'
                  : 'By default, your profile avatar displays the first letter of your name until you choose or upload a custom picture.'}
              </p>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Action Buttons */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#173d4a] text-white hover:bg-[#12303a] shadow-xs transition"
                >
                  <Camera className="h-4 w-4" />
                  <span>{isAm ? 'ፎቶ ጫን' : 'Upload Image'}</span>
                </button>

                {formData.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#fbece5] text-[#c66749] hover:bg-[#f7ded4] border border-[#f5d5c6] transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isAm ? 'አስወግድ' : 'Reset to Initial'}</span>
                  </button>
                )}
              </div>

              {/* Quick Preset Selector */}
              <div className="mt-6 pt-5 border-t border-[#edf3f6] w-full text-left">
                <span className="text-[11px] font-bold text-[#527482] block mb-2.5">
                  {isAm ? 'ወይም ከተዘጋጁት ፎቶዎች ይምረጡ:' : 'Or pick a preset avatar:'}
                </span>
                <div className="grid grid-cols-4 gap-2.5">
                  {AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, avatarUrl: preset.url }))}
                      className={`relative rounded-xl overflow-hidden aspect-square border-2 transition ${
                        formData.avatarUrl === preset.url
                          ? 'border-[#173d4a] ring-2 ring-[#173d4a]/30'
                          : 'border-transparent hover:border-[#cadbe2]'
                      }`}
                      title={preset.label}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Account Role & Assigned Branch Info Card */}
          <div className="bg-white rounded-2xl border border-[#cfdde3] p-5 shadow-clean space-y-3">
            <h3 className="text-xs font-bold text-[#15343f] uppercase tracking-wide">
              {isAm ? 'የመለያ መረጃ' : 'Account Details'}
            </h3>

            <div className="flex items-center justify-between text-xs py-1 border-b border-[#edf3f6]">
              <span className="text-[#728994] font-medium flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-[#4f7988]" />
                {isAm ? 'ሚና' : 'Role'}
              </span>
              <span className="font-extrabold px-2.5 py-0.5 rounded-full bg-[#173d4a] text-white text-[11px]">
                {user?.role || 'STAFF'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-[#728994] font-medium flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-[#4f7988]" />
                {isAm ? 'ቅርንጫፍ' : 'Branch'}
              </span>
              <span className="font-bold text-[#15343f]">
                {user?.branchName || (isAm ? 'ሁሉም ቅርንጫፎች (ማዕከል)' : 'All Branches (HQ)')}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Name, Email, Phone & Password (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Form 1: Personal Details */}
          <form
            onSubmit={handleSaveProfile}
            className="bg-white rounded-2xl border border-[#cfdde3] p-6 shadow-clean space-y-4"
          >
            <h2 className="text-xs font-bold text-[#15343f] uppercase tracking-wide mb-2">
              {isAm ? 'የግል መረጃዎችን ያርትዑ' : 'Edit Personal Details'}
            </h2>

            {/* Full Name (English) */}
            <div>
              <label className="block text-xs font-bold text-[#15343f] mb-1.5">
                {isAm ? 'ሙሉ ስም (እንግሊዝኛ)' : 'Full Name (English)'}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-2.5 h-4 w-4 text-[#8da2ac]" />
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Abebe Kebede"
                  className="w-full rounded-xl border border-[#cadbe2] bg-[#f8fbfa] pl-10 pr-4 py-2 text-xs font-semibold text-[#15343f] focus:border-[#4f7988] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Full Name (Amharic) */}
            <div>
              <label className="block text-xs font-bold text-[#15343f] mb-1.5">
                {isAm ? 'ሙሉ ስም (አማርኛ)' : 'Full Name (Amharic)'}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-2.5 h-4 w-4 text-[#8da2ac]" />
                <input
                  type="text"
                  value={formData.fullNameAm}
                  onChange={(e) => setFormData({ ...formData, fullNameAm: e.target.value })}
                  placeholder="ምሳሌ፡ አበበ ከበደ"
                  className="w-full rounded-xl border border-[#cadbe2] bg-[#f8fbfa] pl-10 pr-4 py-2 text-xs font-semibold text-[#15343f] focus:border-[#4f7988] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-[#15343f] mb-1.5">
                {isAm ? 'ኢሜይል አድራሻ' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-[#8da2ac]" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@berhanstock.et"
                  className="w-full rounded-xl border border-[#cadbe2] bg-[#f8fbfa] pl-10 pr-4 py-2 text-xs font-semibold text-[#15343f] focus:border-[#4f7988] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-[#15343f] mb-1.5">
                {isAm ? 'ስልክ ቁጥር' : 'Phone Number'}
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-2.5 h-4 w-4 text-[#8da2ac]" />
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+251 911 234567"
                  className="w-full rounded-xl border border-[#cadbe2] bg-[#f8fbfa] pl-10 pr-4 py-2 text-xs font-semibold text-[#15343f] focus:border-[#4f7988] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#173d4a] hover:bg-[#12303a] text-white px-5 py-2.5 text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? (isAm ? 'በማስቀመጥ ላይ...' : 'Saving...') : (isAm ? 'ለውጦችን አስቀምጥ' : 'Save Changes')}</span>
              </button>
            </div>
          </form>

          {/* Form 2: Change Password */}
          <form
            onSubmit={handlePasswordChange}
            className="bg-white rounded-2xl border border-[#cfdde3] p-6 shadow-clean space-y-4"
          >
            <h2 className="text-xs font-bold text-[#15343f] uppercase tracking-wide mb-2 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#4f7988]" />
              <span>{isAm ? 'የይለፍ ቃል ቀይር' : 'Change Password'}</span>
            </h2>

            {passwordStatus.error && (
              <div className="p-3 rounded-xl bg-[#fbece5] text-[#c66749] text-xs font-semibold border border-[#f5d5c6]">
                {passwordStatus.error}
              </div>
            )}

            {passwordStatus.success && (
              <div className="p-3 rounded-xl bg-[#e3f2ec] text-[#1c6953] text-xs font-semibold border border-[#c1e5d7]">
                {passwordStatus.success}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#15343f] mb-1.5">
                {isAm ? 'የአሁኑ የይለፍ ቃል' : 'Current Password'}
              </label>
              <input
                type="password"
                required
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#cadbe2] bg-[#f8fbfa] px-4 py-2 text-xs font-semibold text-[#15343f] focus:border-[#4f7988] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#15343f] mb-1.5">
                  {isAm ? 'አዲስ የይለፍ ቃል' : 'New Password'}
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#cadbe2] bg-[#f8fbfa] px-4 py-2 text-xs font-semibold text-[#15343f] focus:border-[#4f7988] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#15343f] mb-1.5">
                  {isAm ? 'አዲሱን የይለፍ ቃል አረጋግጥ' : 'Confirm New Password'}
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#cadbe2] bg-[#f8fbfa] px-4 py-2 text-xs font-semibold text-[#15343f] focus:border-[#4f7988] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-[#edf3f6] hover:bg-[#e2edf2] text-[#173d4a] px-4 py-2.5 text-xs font-bold border border-[#cadbe2] transition"
              >
                <RotateCcw className="h-4 w-4" />
                <span>{isAm ? 'የይለፍ ቃል አድስ' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
