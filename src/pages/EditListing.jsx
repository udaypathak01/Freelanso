import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { gsap } from 'gsap'
import Sidebar from '../components/Sidebar'
import { auth } from '../lib/auth'
import { fetchProjectDB, updateProjectDB } from '../lib/data'
import { fetchServiceCategories, fetchServiceDB, updateServiceDB } from '../lib/serviceData'
import { uploadMedia } from '../lib/cloudinary'

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

export default function EditListing() {
  const { type, id } = useParams()
  const navigate = useNavigate()
  const user = auth.getUser()

  const [loading, setLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [form, setForm] = useState({
    title: '', category: '', level: '', description: '',
    price: '', delivery: 'standard', revisions: 1, skills: [], image: null, mediaType: null, imageAsset: null,
  })
  const [serviceCategories, setServiceCategories] = useState([])

  const [rawFile, setRawFile] = useState(null)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        let data;
        if (type === 'project') {
          data = await fetchProjectDB(id);
        } else {
          const [service, categories] = await Promise.all([
            fetchServiceDB(id),
            fetchServiceCategories(),
          ])
          data = service
          setServiceCategories(categories)
        }

        if (data) {
          setForm({
            title: data.title || '',
            category: data.category || '',
            level: data.level || 'Intermediate',
            description: data.description || '',
            price: String(data.price || '').replace(/[^0-9]/g, ''),
            delivery: data.deliveryDays <= 2 ? 'express' : data.deliveryDays <= 5 ? 'standard' : 'extended',
            revisions: data.revisions ?? 1,
            skills: data.skills || [],
            image: data.imageUrl || data.image || null,
            mediaType: data.mediaType || 'image',
            imageAsset: data.images?.[0] || null,
          });
        }
      } catch (err) {
        console.error("Failed to load listing", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, type]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  
  const loadImage = (file) => {
    if (!file) return
    
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    
    if (!isImage && !isVideo) {
      alert('Please select an image (JPG, PNG, WEBP) or video (MP4, MOV, WebM)')
      return
    }

    console.log(`📁 File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB, type: ${file.type})`)
    setRawFile(file)
    set('imageAsset', null)
    const reader = new FileReader()
    reader.onload = (e) => {
      set('image', e.target.result)
      set('mediaType', isImage ? 'image' : 'video')
      console.log(`👁️ Preview loaded for: ${file.name}`)
    }
    reader.readAsDataURL(file)
  }

  const handleUpdate = async () => {
    setIsUpdating(true)
    try {
      let imageAsset = form.imageAsset
      
      // If a new file was selected, upload it
      if (rawFile) {
        // Log which file we're about to upload
        console.log(`🔝 About to upload file: ${rawFile.name} (${(rawFile.size / 1024 / 1024).toFixed(2)}MB, type: ${rawFile.type})`)
        
        try {
          console.log('📤 Uploading updated media to Cloudinary...')
          const uploadResult = await uploadMedia(rawFile)
          
          if (!uploadResult.url) {
            throw new Error('Cloudinary returned no URL')
          }
          
          console.log(`✅ Successfully received Cloudinary URL: ${uploadResult.url.substring(0, 60)}...`)
          if (!uploadResult.publicId) {
            throw new Error('Cloudinary did not return a public asset ID')
          }
          imageAsset = {
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            mediaType: uploadResult.mediaType,
            resourceType: uploadResult.resourceType,
          }
          console.log('✅ Updated media uploaded:', { 
            fileName: rawFile.name, 
            url: uploadResult.url.substring(0, 60),
            type: uploadResult.mediaType 
          })
        } catch (err) {
          console.error("❌ Upload failed:", err)
          alert('Media upload failed. Update cancelled.')
          setIsUpdating(false)
          return
        }
      } else {
        // No new file selected, keep existing image URL
        console.log('ℹ️ No new file selected, keeping existing image')
        imageAsset = form.imageAsset
      }

      const payload = type === 'project'
        ? {
            title: form.title,
            category: form.category,
            ...(form.level ? { level: form.level } : {}),
            description: form.description,
            price: Number(form.price),
            deliveryDays: { express: 2, standard: 5, extended: 14 }[form.delivery],
            tags: [],
            skills: form.skills,
            images: imageAsset ? [imageAsset] : [],
          }
        : {
            title: form.title,
            category: form.category,
            description: form.description,
            price: Number(form.price),
            deliveryDays: { express: 2, standard: 5, extended: 14 }[form.delivery],
            revisions: Number(form.revisions),
            skills: form.skills,
            images: imageAsset ? [imageAsset] : [],
          }

      console.log('💾 Updating listing:', {
        title: payload.title,
        imageUrl: payload.images[0]?.url?.substring(0, 60),
        mediaType: payload.images[0]?.mediaType
      })
      if (type === 'project') {
        await updateProjectDB(id, payload)
      } else {
        await updateServiceDB(id, payload)
      }

      console.log('✅ Listing updated successfully!')
      setShowSuccess(true)
    } catch (err) {
      alert("Update failed: " + err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#09090B] flex items-center justify-center text-white font-black uppercase tracking-widest animate-pulse">Loading Listing...</div>

  return (
    <div className="flex min-h-screen bg-[#09090B] text-white overflow-hidden">
      <div className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? 'w-[78px]' : 'w-[240px]'}`}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      <main className="flex-1 min-w-0 flex flex-col items-center justify-center p-10 overflow-y-auto">
        <div className="w-full max-w-[700px] bg-[#121216] border border-white/5 rounded-[40px] p-10 shadow-2xl">
          <h1 className="font-syne font-black text-3xl mb-2">Edit {type === 'project' ? 'Project' : 'Service'}</h1>
          <p className="text-[#666] font-bold text-sm mb-10">Update your visibility on the platform</p>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 block">Title</label>
              <input 
                value={form.title} 
                onChange={e => set('title', e.target.value)}
                className="w-full bg-[#09090B] border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:border-[#0066FF]/40 transition-all font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 block">Price (₹)</label>
                  <input 
                    type="number"
                    value={form.price} 
                    onChange={e => set('price', e.target.value)}
                    className="w-full bg-[#09090B] border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:border-[#0066FF]/40 transition-all font-bold"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 block">Category</label>
                  <select 
                    value={form.category} 
                    onChange={e => set('category', e.target.value)}
                    className="w-full bg-[#09090B] border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:border-[#0066FF]/40 transition-all font-bold appearance-none"
                  >
                    {(type === 'project' ? CATEGORIES : serviceCategories.map(category => ({ value: category.slug, label: category.label }))).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
               </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 block">Description</label>
              <textarea 
                value={form.description} 
                rows={5}
                onChange={e => set('description', e.target.value)}
                className="w-full bg-[#09090B] border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:border-[#0066FF]/40 transition-all font-bold resize-none"
              />
            </div>

            {/* Image/Video Preview / Upload */}
            <div 
              onClick={() => document.getElementById('edit-file').click()}
              className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 cursor-pointer group bg-[#09090B]"
            >
               {form.mediaType === 'video' ? (
                 <>
                   <video src={form.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <svg width="48" height="48" viewBox="0 0 24 24" fill="white" className="opacity-60"><path d="M8 5v14l11-7z" /></svg>
                   </div>
                 </>
               ) : (
                 <img src={form.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
               )}
               <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="bg-white text-black px-6 py-2 rounded-full font-black text-[10px] uppercase">Change Media</span>
               </div>
               <input id="edit-file" type="file" accept="image/*,video/*" hidden onChange={e => loadImage(e.target.files[0])} />
            </div>

            <div className="flex gap-4 pt-4">
               <button 
                 onClick={() => navigate(-1)}
                 className="flex-1 py-4 bg-white/5 text-white font-black text-xs uppercase rounded-2xl hover:bg-white/10 transition-all"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleUpdate}
                 disabled={isUpdating}
                 className="flex-[2] py-4 bg-[#0066FF] text-white font-black text-xs uppercase rounded-2xl hover:scale-[1.02] shadow-[0_10px_30px_rgba(0,102,255,0.2)] transition-all disabled:opacity-50"
               >
                 {isUpdating ? 'Updating...' : 'Save Changes'}
               </button>
            </div>
          </div>
        </div>

        {/* Success Modal */}
        {showSuccess && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl">
            <div className="bg-[#121216] border border-white/10 rounded-[40px] p-12 text-center max-w-[400px]">
               <div className="text-6xl mb-6">✅</div>
               <h2 className="text-2xl font-black mb-2">Update Complete</h2>
               <p className="text-sm font-bold text-[#666] mb-8">Your listing has been successfully updated on the platform.</p>
               <button onClick={() => navigate('/explore')} className="w-full py-4 bg-[#0066FF] text-white font-black rounded-2xl shadow-lg">Back to discovery</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
