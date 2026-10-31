import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import Sidebar from '../components/Sidebar'
import Avatar from '../components/Avatar'
import { auth } from '../lib/auth'

/* ─────────────────────────── DATA ─────────────────────────── */
const STEPS = [
  { label: 'Project Details', sub: 'Title & description' },
  { label: 'Pricing & Skills', sub: 'Budget & expertise' },
  { label: 'Media Upload', sub: 'Cover image' },
  { label: 'Publish', sub: 'Go live!' },
]

const CATEGORIES = [
  { value: 'logo-design', label: 'Logo Design' },
  { value: 'ui-ux-design', label: 'UI/UX Design' },
  { value: 'web-development', label: 'Web Development' },
  { value: 'video-editing', label: 'Video Editing' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'content-writing', label: 'Content Writing' },
  { value: 'seo-marketing', label: 'SEO / Marketing' },
  { value: 'motion-graphics', label: 'Motion Graphics' },
]
const LEVELS = ['Beginner', 'Intermediate', 'Expert']
const QUICK_PRICES = [500, 1000, 1500, 2500, 5000]
const DELIVERY_OPTIONS = [
  { days: '2d', label: 'Express', extra: '+₹200', id: 'express' },
  { days: '5d', label: 'Standard', extra: 'Included', id: 'standard' },
  { days: '14d', label: 'Extended', extra: 'Discount', id: 'extended' },
]
const ALL_SKILLS = [
  'Figma', 'React', 'Next.js', 'Tailwind', 'GSAP', 'After Effects',
  'Premiere', 'Blender', '3D', 'Webflow', 'Framer', 'Node.js',
  'Python', 'Illustrator', 'Photoshop', 'SEO', 'Canva', 'TypeScript', 'Vue', 'Svelte',
]
const TIPS = [
  { icon: '📸', text: 'Use clear, relevant project images' },
  { icon: '₹', text: 'Set a price that reflects your scope' },
  { icon: '🏷', text: 'Add skills that describe your work' },
  { icon: '⚡', text: 'Set a delivery time you can meet' },
]

/* ─────────────────────────── HELPERS ─────────────────────────── */
const fmtPrice = (v) => v ? `₹${Number(v).toLocaleString()}` : '—'

/* ─────────────────────────── COMPONENT ─────────────────────────── */
import { saveProjectDB } from '../lib/data'
import { uploadMedia } from '../lib/cloudinary'

const MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
])
const MAX_MEDIA_COUNT = 10
const MAX_MEDIA_BYTES = 100 * 1024 * 1024
const PROJECT_LINK_LABELS = [
  'Live Demo',
  'GitHub',
  'Behance',
  'Figma',
  'Dribbble',
  'Website',
  'Other',
]

export default function PostWork() {
  const navigate = useNavigate()
  const user = auth.getUser()

  const [uploadStage, setUploadStage] = useState('idle') // 'idle'|'validating'|'uploading'|'saving'|'done'
  const [publishedData, setPublishedData] = useState(null) // captures title/price/category for the success modal
  const [collapsed, setCollapsed] = useState(false)
  const [form, setForm] = useState({
    title: '', category: '', level: '', description: '',
    price: '', delivery: 'standard', skills: [], image: null, mediaType: null,
  })

  const [step, setStep] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState([])
  const [coverMediaId, setCoverMediaId] = useState(null)
  const [mediaErrors, setMediaErrors] = useState([])
  const [projectLinks, setProjectLinks] = useState([])
  const [linkLabel, setLinkLabel] = useState(PROJECT_LINK_LABELS[0])
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState('')
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 })

  const containerRef = useRef(null)
  const stepRefs = useRef([])
  const strengthBarRef = useRef(null)
  const confettiRefs = useRef([])
  const mediaUrlsRef = useRef(new Set())

  const checks = [
    form.title.trim().length >= 4,
    !!form.category,
    form.description.length >= 100,
    !!form.price,
    form.skills.length >= 2,
    selectedMedia.length > 0,
  ]
  const strength = Math.round((checks.filter(Boolean).length / checks.length) * 100)

  useEffect(() => {
    if (strengthBarRef.current) {
      gsap.to(strengthBarRef.current, { width: strength + '%', duration: 0.5, ease: 'power2.out' })
    }
  }, [strength])

  const handleStepChange = (newStep) => {
    if (newStep === step) return
    const el = stepRefs.current[newStep]
    if (el) gsap.to(el, { scale: 1.15, duration: 0.2, yoyo: true, repeat: 1 })
    setStep(newStep)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleSkill = (s) => set('skills',
    form.skills.includes(s) ? form.skills.filter(x => x !== s) : [...form.skills, s]
  )

  useEffect(() => () => {
    mediaUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    mediaUrlsRef.current.clear()
  }, [])

  const loadMedia = (files) => {
    const incomingFiles = Array.from(files || [])
    if (!incomingFiles.length) return
    const errors = []
    const validFiles = []
    const remainingSlots = MAX_MEDIA_COUNT - selectedMedia.length

    incomingFiles.forEach((file) => {
      if (!MEDIA_TYPES.has(file.type)) {
        errors.push(`${file.name}: use JPG, PNG, WebP, MP4, MOV, or WebM.`)
      } else if (file.size > MAX_MEDIA_BYTES) {
        errors.push(`${file.name}: file exceeds the 100 MB limit.`)
      } else {
        validFiles.push(file)
      }
    })
    if (validFiles.length > remainingSlots) {
      errors.push(`You can add up to ${MAX_MEDIA_COUNT} files.`)
    }

    const acceptedFiles = validFiles.slice(0, Math.max(remainingSlots, 0))
    const additions = acceptedFiles.map((file) => {
      const preview = URL.createObjectURL(file)
      mediaUrlsRef.current.add(preview)
      return {
        id: crypto.randomUUID(),
        file,
        preview,
        type: file.type.startsWith('video/') ? 'video' : 'image',
      }
    })
    setSelectedMedia((current) => [...current, ...additions])
    setCoverMediaId((current) => current || additions[0]?.id || null)
    setMediaErrors(errors)
  }

  const removeMedia = (mediaId) => {
    const item = selectedMedia.find(({ id }) => id === mediaId)
    if (item) {
      URL.revokeObjectURL(item.preview)
      mediaUrlsRef.current.delete(item.preview)
    }
    const remaining = selectedMedia.filter(({ id }) => id !== mediaId)
    setSelectedMedia(remaining)
    if (coverMediaId === mediaId) setCoverMediaId(remaining[0]?.id || null)
  }

  const addProjectLink = () => {
    setLinkError('')
    if (projectLinks.length >= 5) {
      setLinkError('You can add up to 5 project links.')
      return
    }
    try {
      const parsed = new URL(linkUrl.trim())
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.href.length > 2048) throw new Error()
      setProjectLinks((current) => [...current, { label: linkLabel, url: parsed.href }])
      setLinkUrl('')
    } catch {
      setLinkError('Enter a valid http:// or https:// URL.')
    }
  }

  const handleSubmit = async () => {
    if (!form.title || !form.price) return

    // ── Stage 1: Validate ──────────────────────────────────────────
    setUploadStage('validating')

    if (!selectedMedia.length) {
      alert('\u274c No file selected. Please upload an image or video before publishing.')
      setUploadStage('idle')
      return
    }

    // ── Stage 2: Upload to Cloudinary CDN ─────────────────────────
    setUploadStage('uploading')
    setUploadProgress({ completed: 0, total: selectedMedia.length })
    const uploadedMedia = []

    try {
      for (const [index, item] of selectedMedia.entries()) {
        console.log(`📤 Uploading: ${item.file.name} (${(item.file.size / 1024 / 1024).toFixed(2)}MB)`)
        const uploadResult = await uploadMedia(item.file)
        if (!uploadResult.url || !uploadResult.publicId) {
          throw new Error(`Upload did not return a valid asset for ${item.file.name}`)
        }
        uploadedMedia.push({
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          type: uploadResult.mediaType,
          mediaType: uploadResult.mediaType,
          resourceType: uploadResult.resourceType,
          isCover: item.id === coverMediaId,
        })
        setUploadProgress({ completed: index + 1, total: selectedMedia.length })
      }
    } catch (err) {
      console.error('\u274c Cloudinary upload failed:', err)
      const message = err.message === 'Upload preset not found'
        ? 'Cloudinary could not find the project upload preset. Set CLOUDINARY_PROJECT_UPLOAD_PRESET on the API to the exact signed preset name in the configured Cloudinary account, then restart the API.'
        : `Image/video upload failed: ${err.message}`
      alert(message)
      setUploadStage('idle')
      return
    }

    // ── Stage 3: Save to Express API → Firestore ──────────────────
    setUploadStage('saving')

    const payload = {
      title: form.title,
      category: form.category,
      ...(form.level ? { level: form.level } : {}),
      description: form.description,
      price: Number(form.price),
      deliveryDays: { express: 2, standard: 5, extended: 14 }[form.delivery],
      tags: [],
      skills: form.skills,
      media: uploadedMedia,
      links: projectLinks,
    }

    try {
      console.log('\ud83d\udcbe Saving to Firestore via Express...', payload.title)
      await saveProjectDB(payload)
      console.log('\u2705 Project published successfully!')
    } catch (e) {
      alert('Failed to save: ' + e.message)
      setUploadStage('idle')
      return
    }

    // ── Stage 4: Done — capture modal data BEFORE clearing form ───
    setPublishedData({ title: form.title, price: form.price, category: form.category })

    setForm({
      title: '', category: '', level: '', description: '',
      price: '', delivery: 'standard', skills: [], image: null, mediaType: null,
    })
    mediaUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    mediaUrlsRef.current.clear()
    setSelectedMedia([])
    setCoverMediaId(null)
    setProjectLinks([])
    setMediaErrors([])
    setUploadProgress({ completed: 0, total: 0 })
    const fileInput = document.getElementById('file-input')
    if (fileInput) fileInput.value = ''

    setUploadStage('done')
    setShowSuccess(true)
    setTimeout(() => {
      if (confettiRefs.current.length) {
        gsap.from(confettiRefs.current, {
          y: -20, opacity: 0, stagger: 0.08, rotate: 45, duration: 0.5, ease: 'back.out(1.5)'
        })
      }
    }, 80)
  }

  const catColor = (c) => {
    if (!c) return 'bg-white/5 text-[#666]'
    if (c.includes('Logo') || c.includes('Illustration')) return 'bg-blue-500/15 text-blue-400'
    if (c.includes('UI') || c.includes('Motion')) return 'bg-purple-500/15 text-purple-400'
    if (c.includes('Video')) return 'bg-[#0066FF]/15 text-[#0066FF]'
    if (c.includes('Web') || c.includes('Dev')) return 'bg-[#0066FF]/15 text-[#0066FF]'
    return 'bg-white/5 text-[#666]'
  }
  const selectedCover = selectedMedia.find(({ id }) => id === coverMediaId) || selectedMedia[0]

  return (
    <div className="flex min-h-screen bg-[#09090B] text-white overflow-hidden" ref={containerRef}>
      <div className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? 'w-[78px]' : 'w-[240px]'}`}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {/* Progress Header */}
        <div className="sticky top-0 z-50 bg-[#09090B]/80 backdrop-blur-xl border-b border-white/5 py-6 px-10">
          <div className="max-w-[1000px] mx-auto flex items-start justify-between">
            {STEPS.map((s, i) => {
              const done = i < step
              const active = i === step
              return (
                <div key={i} className="flex-1 flex items-start last:flex-none">
                  <div className="flex flex-col items-center cursor-pointer group" onClick={() => handleStepChange(i)}>
                    <div
                      ref={el => stepRefs.current[i] = el}
                      className={`w-8 h-8 rounded-full border flex items-center justify-center font-black text-xs transition-all duration-300 ${
                        done    ? 'border-[#0066FF] bg-[#0066FF] text-white'
                        : active ? 'border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF] shadow-[0_0_15px_rgba(0,102,255,0.2)]'
                        :          'border-white/10 text-[#444] group-hover:border-white/20 group-hover:text-[#888]'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </div>
                    <div className="mt-2 text-center">
                      <div className={`text-[10px] font-black uppercase tracking-wider ${active ? 'text-white' : done ? 'text-[#0066FF]' : 'text-[#444]'}`}>{s.label}</div>
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px mt-4 mx-4 transition-colors duration-500 ${done ? 'bg-[#0066FF]/40' : 'bg-white/5'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-10">
          <div className="max-w-[1000px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 items-start">
            
            {/* Form Column */}
            <div className="space-y-6">
              {/* SECTION 1: Details */}
              <FormCard title="Project Details" stepNum={1} active={step >= 0}>
                <div className="p-8 space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3 block">Project Title</label>
                    <input
                      maxLength={80}
                      value={form.title}
                      onChange={e => set('title', e.target.value)}
                      placeholder="e.g. Design a modern SaaS landing page"
                      className="w-full bg-[#121216] border border-white/10 rounded-2xl py-4 px-5 text-sm outline-none focus:border-[#0066FF]/40 transition-all font-bold"
                      onFocus={() => handleStepChange(0)}
                    />
                    <div className="text-right text-[10px] text-[#444] mt-2 font-bold">{form.title.length}/80</div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3 block">Category</label>
                      <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full bg-[#121216] border border-white/10 rounded-2xl py-4 px-5 text-sm outline-none focus:border-[#0066FF]/40 transition-all font-bold appearance-none cursor-pointer">
                        <option value="">Select category</option>
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3 block">Experience</label>
                      <select value={form.level} onChange={e => set('level', e.target.value)} className="w-full bg-[#121216] border border-white/10 rounded-2xl py-4 px-5 text-sm outline-none focus:border-[#0066FF]/40 transition-all font-bold appearance-none cursor-pointer">
                        <option value="">Select level</option>
                        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3 block">Description</label>
                    <textarea
                      maxLength={500}
                      value={form.description}
                      rows={4}
                      onChange={e => set('description', e.target.value)}
                      placeholder="Describe your service clearly..."
                      className="w-full bg-[#121216] border border-white/10 rounded-2xl py-4 px-5 text-sm outline-none focus:border-[#0066FF]/40 transition-all font-bold resize-none min-h-[120px]"
                    />
                    <div className="flex justify-between mt-2">
                       <span className={`text-[10px] font-bold ${form.description.length >= 100 ? 'text-[#0066FF]' : 'text-[#444]'}`}>
                        {form.description.length >= 100 ? '✓ Requirements met' : `${100 - form.description.length} more chars needed`}
                      </span>
                      <span className="text-[10px] text-[#444] font-bold">{form.description.length}/500</span>
                    </div>
                  </div>
                </div>
              </FormCard>

              {/* SECTION 2: Pricing */}
              <FormCard title="Pricing & Skills" stepNum={2} active={step >= 1}>
                <div className="p-8 space-y-8">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3 block">Fixed Price</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-[#666]">₹</span>
                      <input
                        type="number"
                        value={form.price}
                        onChange={e => { set('price', e.target.value); handleStepChange(1) }}
                        placeholder="0"
                        className="w-full bg-[#121216] border border-white/10 rounded-2xl py-4 pl-10 pr-5 text-sm outline-none focus:border-[#0066FF]/40 transition-all font-bold"
                      />
                    </div>
                    <div className="flex gap-2 mt-3">
                      {QUICK_PRICES.map(p => (
                        <button key={p} onClick={() => set('price', String(p))} className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${form.price === String(p) ? 'bg-[#0066FF] border-[#0066FF] text-white' : 'border-white/5 text-[#555] hover:text-white hover:bg-white/5'}`}>₹{p.toLocaleString()}</button>
                      ))}
                    </div>
                  </div>

                   <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3 block">Delivery</label>
                    <div className="grid grid-cols-3 gap-3">
                      {DELIVERY_OPTIONS.map(opt => (
                        <div key={opt.id} onClick={() => set('delivery', opt.id)} className={`p-4 rounded-2xl border cursor-pointer transition-all text-center ${form.delivery === opt.id ? 'bg-[#0066FF]/10 border-[#0066FF]/40' : 'bg-[#121216] border-white/5 hover:border-white/10'}`}>
                          <div className="text-sm font-black text-white">{opt.days}</div>
                          <div className="text-[9px] font-bold text-[#555] uppercase mt-1">{opt.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-4 block">Skills</label>
                    <div className="flex flex-wrap gap-2">
                       {ALL_SKILLS.map(s => (
                        <button key={s} onClick={() => toggleSkill(s)} className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all ${form.skills.includes(s) ? 'bg-[#0066FF] border-[#0066FF] text-white' : 'border-white/5 text-[#555] hover:text-white hover:bg-white/5'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </FormCard>

              {/* SECTION 3: Media */}
              <FormCard title="Media Upload" stepNum={3} active={step >= 2}>
                <div className="p-8 space-y-6">
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); loadMedia(e.dataTransfer.files) }}
                    onClick={() => document.getElementById('file-input').click()}
                    className={`border-2 border-dashed rounded-[24px] p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      dragOver ? 'border-[#0066FF]/50 bg-[#0066FF]/5 text-[#0066FF]' : 'border-white/10 hover:border-[#0066FF]/30 text-[#555] hover:text-[#888]'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-[#121216] border border-white/5 flex items-center justify-center mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                    </div>
                    <h4 className="text-sm font-black text-white mb-1">
                      {selectedMedia.length ? 'Add more project media' : 'Click to upload cover image or video'}
                    </h4>
                    <p className="text-xs font-medium text-[#555]">Up to 10 files • 100MB each • JPG, PNG, WEBP • MP4, MOV, WebM</p>
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                    multiple
                    className="hidden"
                    onChange={e => { loadMedia(e.target.files); e.target.value = '' }}
                  />
                  {mediaErrors.length > 0 && (
                    <div role="alert" className="space-y-1 text-xs font-bold text-red-400">
                      {mediaErrors.map((error) => <p key={error}>{error}</p>)}
                    </div>
                  )}
                  {selectedMedia.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selectedMedia.map((item, index) => (
                        <div
                          key={item.id}
                          className={`relative overflow-hidden rounded-xl border ${item.id === (selectedCover?.id) ? 'border-[#0066FF]' : 'border-white/10'}`}
                        >
                          {item.type === 'video' ? (
                            <video src={item.preview} className="w-full h-28 object-cover bg-black" muted />
                          ) : (
                            <img src={item.preview} alt={item.file.name} className="w-full h-28 object-cover" />
                          )}
                          <div className="flex items-center justify-between gap-2 bg-[#121216] p-2">
                            <button
                              type="button"
                              onClick={() => setCoverMediaId(item.id)}
                              className={`truncate text-[10px] font-black ${item.id === selectedCover?.id ? 'text-[#60A5FA]' : 'text-[#888] hover:text-white'}`}
                            >
                              {item.id === selectedCover?.id ? 'Cover' : `Set as cover ${index + 1}`}
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${item.file.name}`}
                              onClick={() => removeMedia(item.id)}
                              className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs font-black text-white hover:bg-red-500"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4 border-t border-white/5 pt-6">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-[#555]">Project Links</h4>
                      <p className="mt-1 text-xs text-[#666]">Add up to 5 links to demos, portfolios, or project files.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select
                        value={linkLabel}
                        onChange={(event) => setLinkLabel(event.target.value)}
                        className="bg-[#121216] border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-[#0066FF]/40 transition-all font-bold"
                      >
                        {PROJECT_LINK_LABELS.map((label) => <option key={label}>{label}</option>)}
                      </select>
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(event) => setLinkUrl(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            addProjectLink()
                          }
                        }}
                        placeholder="https://example.com"
                        className="min-w-0 flex-1 bg-[#121216] border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-[#0066FF]/40 transition-all font-bold"
                      />
                      <button
                        type="button"
                        onClick={addProjectLink}
                        disabled={projectLinks.length >= 5 || !linkUrl.trim()}
                        className="rounded-xl bg-[#0066FF] px-5 py-3 text-xs font-black text-white disabled:opacity-40"
                      >
                        Add link
                      </button>
                    </div>
                    {linkError && <p role="alert" className="text-xs font-bold text-red-400">{linkError}</p>}
                    <div className="space-y-2">
                      {projectLinks.map((link, index) => (
                        <div key={`${link.url}-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-[#121216] px-4 py-3 text-sm">
                          <span className="min-w-0 truncate text-white">
                            <span className="mr-2 font-black text-[#60A5FA]">{link.label}</span>
                            <span className="text-[#888]">{link.url}</span>
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${link.label} link`}
                            onClick={() => setProjectLinks((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                            className="shrink-0 text-[#888] hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </FormCard>

              {/* SECTION 4: Submit */}
              <div className="p-1 pt-4 space-y-4">

                {/* ─── 4-stage Upload Pipeline Progress ─── */}
                {uploadStage !== 'idle' && (
                  <div className="bg-[#121216] border border-[#0066FF]/20 rounded-2xl p-5">
                    <p className="text-[9px] font-black uppercase tracking-[3px] text-[#444] mb-4 text-center">Upload Pipeline</p>
                    {uploadStage === 'uploading' && uploadProgress.total > 0 && (
                      <div className="mb-5">
                        <div className="mb-2 flex justify-between text-[10px] font-bold text-[#888]">
                          <span>Uploading media</span>
                          <span>{uploadProgress.completed}/{uploadProgress.total}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full bg-[#0066FF] transition-all"
                            style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="relative flex items-start justify-between">
                      {/* Connector line behind the circles */}
                      <div className="absolute top-4 left-[12%] right-[12%] h-px bg-white/5" />
                      {[
                        { id: 'validating', icon: '\ud83d\udd0d', label: 'Validate' },
                        { id: 'uploading',  icon: '\u2601\ufe0f',  label: 'CDN Upload' },
                        { id: 'saving',     icon: '\ud83d\udcbe', label: 'Save to DB' },
                        { id: 'done',       icon: '\u2705',        label: 'Published' },
                      ].map((s) => {
                        const ORDER = ['validating', 'uploading', 'saving', 'done']
                        const currentIdx = ORDER.indexOf(uploadStage)
                        const thisIdx    = ORDER.indexOf(s.id)
                        const done   = thisIdx < currentIdx
                        const active = thisIdx === currentIdx
                        return (
                          <div key={s.id} className="flex-1 flex flex-col items-center gap-2 z-10">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-black transition-all duration-500 ${
                              done   ? 'bg-[#00FF88] text-black scale-110 shadow-[0_0_12px_rgba(0,255,136,0.4)]'
                              : active ? 'bg-[#0066FF] text-white shadow-[0_0_16px_rgba(0,102,255,0.5)] animate-pulse'
                              :          'bg-[#09090B] border border-white/10 text-[#2a2a2a]'
                            }`}>
                              {done ? '\u2713' : s.icon}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-wider text-center leading-tight ${
                              active ? 'text-[#0066FF]' : done ? 'text-[#00FF88]' : 'text-[#2a2a2a]'
                            }`}>{s.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={uploadStage !== 'idle' || !form.title || !form.price}
                  className="w-full bg-[#0066FF] text-white rounded-2xl py-5 font-black uppercase tracking-wider text-sm hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40 shadow-[0_15px_30px_rgba(0,102,255,0.2)]"
                >
                  {uploadStage === 'idle'      && '\ud83d\ude80 Publish My Listing'}
                  {uploadStage === 'validating' && '\ud83d\udd0d Validating...'}
                  {uploadStage === 'uploading'  && '\u2601\ufe0f  Uploading to CDN...'}
                  {uploadStage === 'saving'     && '\ud83d\udcbe Saving to Database...'}
                  {uploadStage === 'done'       && '\u2705 Published!'}
                </button>
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="sticky top-[100px] space-y-6">
               {/* Preview Card */}
               <div className="bg-[#121216] border border-white/5 rounded-[28px] overflow-hidden">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#555]">Card Preview</span>
                  <div className="flex items-center gap-1.5 font-black text-[9px] text-[#0066FF] uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0066FF] animate-pulse" />
                    Live
                  </div>
                </div>
                <div className="p-5">
                  <div className="bg-[#09090B] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="w-full h-[140px] bg-white/[0.03] flex items-center justify-center relative group">
                      {selectedCover ? (
                        <>
                          {selectedCover.type === 'video' ? (
                            <>
                              <video src={selectedCover.preview} className="w-full h-full object-cover" muted />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="white" className="opacity-80"><path d="M8 5v14l11-7z" /></svg>
                              </div>
                            </>
                          ) : (
                            <img src={selectedCover.preview} alt="Project cover preview" className="w-full h-full object-cover" />
                          )}
                        </>
                      ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                      )}
                    </div>
                    <div className="p-4">
                      <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block mb-2 ${catColor(form.category)}`}>
                        {CATEGORIES.find(c => c.value === form.category)?.label || 'Category'}
                      </div>
                      <h4 className="text-xs font-black mb-3 line-clamp-2 min-h-[32px]">{form.title || 'Untitled Project'}</h4>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar 
                            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.name || 'Me')}`} 
                            name={user?.name || 'Me'} 
                            size="w-5 h-5" 
                            className="rounded-full" 
                          />
                          <span className="text-[10px] font-black">{user?.name || 'Anonymous Creator'}</span>
                        </div>
                        <span className="text-sm font-black">{form.price ? fmtPrice(form.price) : '₹—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strength */}
              <div className="bg-[#121216] border border-white/5 rounded-[28px] p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#555]">Strength</span>
                  <span className="text-sm font-black text-[#0066FF]">{strength}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-6">
                  <div className="h-full bg-[#0066FF] transition-all duration-500 shadow-[0_0_10px_rgba(0,102,255,0.5)]" style={{ width: `${strength}%` }} />
                </div>
                <div className="space-y-3">
                   {[
                    [checks[0], 'Title provided'],
                    [checks[1], 'Category set'],
                    [checks[2], 'Detailed description'],
                    [checks[3], 'Pricing set'],
                    [checks[4], 'Skills added'],
                    [checks[5], 'Cover uploaded'],
                  ].map(([done, text], i) => (
                    <div key={i} className={`flex items-center gap-3 transition-opacity ${done ? 'opacity-100' : 'opacity-40'}`}>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${done ? 'bg-[#0066FF] text-white' : 'bg-white/5 text-[#444]'}`}>
                        {done ? '✓' : ''}
                      </div>
                      <span className="text-[10px] font-bold">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="bg-[#121216] border border-white/10 rounded-[40px] p-10 text-center max-w-[440px] w-full shadow-2xl overflow-hidden relative">
             <div className="absolute top-0 left-0 w-full h-1 bg-[#0066FF]" />
             <div className="text-5xl mb-6 scale-125">🚀</div>
             <h2 className="text-2xl font-black mb-2">Listing Published!</h2>
             <p className="text-sm font-bold text-[#666] mb-8 leading-relaxed">Your project is now live on Freelanso discovery platform and visible to everyone.</p>
             
             <div className="bg-black/20 border border-white/5 p-4 rounded-2xl text-left mb-8 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0066FF" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m22 4-10 10.01-3-3" /></svg>
                </div>
                <div>
                   <h4 className="text-xs font-black truncate">{publishedData?.title}</h4>
                   <p className="text-[10px] font-bold text-[#0066FF] uppercase tracking-wider mt-0.5">{fmtPrice(publishedData?.price)} · {publishedData?.category}</p>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { setShowSuccess(false); setPublishedData(null); setUploadStage('idle'); setForm({ title:'', category:'', level:'', description:'', price:'', delivery:'standard', skills:[], image:null, mediaType:null }); setSelectedMedia([]); setCoverMediaId(null); setProjectLinks([]); setMediaErrors([]); setStep(0); }} className="px-6 py-4 rounded-2xl bg-white/5 text-white font-black text-xs uppercase hover:bg-white/10 transition-all">Post New</button>
                <button onClick={() => navigate('/explore')} className="px-6 py-4 rounded-2xl bg-[#0066FF] text-white font-black text-xs uppercase hover:scale-105 transition-all shadow-lg">View Feed</button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FormCard({ title, stepNum, children }) {
  return (
    <div className="bg-[#121216] border border-white/5 rounded-[32px] overflow-hidden">
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-lg font-black">{title}</h2>
        <span className="text-[9px] font-black uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full text-[#444]">
          Step {stepNum} of 4
        </span>
      </div>
      {children}
    </div>
  )
}
