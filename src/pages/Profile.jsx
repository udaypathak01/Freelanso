import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import Sidebar from '../components/Sidebar'
import ProjectCard from '../components/ProjectCard'
import Avatar from '../components/Avatar'
import { createConversation, fetchMyProjectsDB, fetchProjects } from '../lib/data'
import { fetchServices } from '../lib/serviceData'
import { auth } from '../lib/auth'
import { apiRequest } from '../lib/api'

function toProfileView(profile) {
  return {
    ...profile,
    name: profile.displayName || '',
    avatar: profile.photoURL || '',
    banner: profile.bannerURL || '',
    role: profile.headline || '',
    handle: profile.handle || (profile.displayName || '').replace(/\s+/g, '').toLowerCase(),
    country: profile.location?.country || '',
    state: profile.location?.state || '',
    city: profile.location?.city || '',
    address1: profile.privateAddress?.line1 || '',
    address2: profile.privateAddress?.line2 || '',
    pincode: profile.privateAddress?.postalCode || '',
  }
}

function toProfileUpdate(form) {
  return {
    displayName: form.name,
    headline: form.role,
    bio: form.bio,
    handle: form.handle,
    phone: form.phone,
    location: {
      country: form.country,
      state: form.state,
      city: form.city,
    },
    privateAddress: {
      line1: form.address1,
      line2: form.address2,
      postalCode: form.pincode,
    },
    skills: form.skills,
    languages: form.languages,
    experience: form.experience,
    education: form.education,
    certifications: form.certifications,
  }
}

export default function Profile() {
  const { uid: routeUid } = useParams()
  const currentUser = auth.getUser()
  const profileUid = routeUid || currentUser?.uid
  const isOwnProfile = !routeUid || routeUid === currentUser?.uid

  const [showEditScreen, setShowEditScreen] = useState(false)
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [skillForm, setSkillForm] = useState({ category: '', tool: '', skillName: '' })
  
  const [showExpModal, setShowExpModal] = useState(false)
  const [expForm, setExpForm] = useState({ title: '', company: '', city: '', country: '', startMonth: '', startYear: '', isCurrent: false, endMonth: '', endYear: '', description: '' })
  
  const [showEduModal, setShowEduModal] = useState(false)
  const [eduForm, setEduForm] = useState({ school: '', degree: '', field: '', startYear: '', endYear: '', description: '' })
  
  const [showCertModal, setShowCertModal] = useState(false)
  const [certForm, setCertForm] = useState({ name: '', issuer: '', year: '' })
  
  const [editTab, setEditTab] = useState('Identity')
  const [editForm, setEditForm] = useState({ 
    name: '', role: '', phone: '', handle: '', bio: '', country: '', state: '', city: '', address1: '', address2: '', pincode: '', skills: [], languages: [], experience: [], education: [], certifications: []
  })
  const [isUpdating, setIsUpdating] = useState(false)
  
  const [profileData, setProfileData] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('Posts')
  const [myProjects, setMyProjects] = useState([])
  const [myServices, setMyServices] = useState([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const handleMessageProfile = async () => {
    if (!currentUser) {
      navigate('/login', { state: { from: `/profile/${encodeURIComponent(profileUid)}` } })
      return
    }
    try {
      const conversation = await createConversation(profileUid)
      navigate(`/messages/${encodeURIComponent(conversation.id)}`)
    } catch (error) {
      setProfileError(error.message || 'Unable to start a conversation.')
    }
  }

  useEffect(() => {
    const loadProfile = async () => {
      if (!profileUid) return navigate('/login')
      
      setLoading(true)
      setProfileError('')
      try {
        const profileResponse = await apiRequest(
          `/users/${isOwnProfile ? 'me' : encodeURIComponent(profileUid)}`,
          {},
          isOwnProfile,
        )
        const profile = toProfileView(profileResponse.data)
        setProfileData(profile)
        setEditForm(prev => ({ ...prev, ...profile }))
        const [projects, services] = await Promise.all([
          isOwnProfile ? fetchMyProjectsDB() : fetchProjects(),
          fetchServices(),
        ])
        setMyProjects(projects.filter(p => p.authorUid === profileUid))
        setMyServices(services.filter(s => s.authorUid === profileUid))
        
      } catch (err) {
        console.error("Profile load error:", err)
        setProfileError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [profileUid, isOwnProfile, navigate])

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsUpdating(true)
    try {
      const { uploadImage } = await import('../lib/cloudinary')
      const url = await uploadImage(file)
      const res = await apiRequest(`/users/${encodeURIComponent(currentUser.uid)}`, { method: 'PUT', body: JSON.stringify({ photoURL: url }) }, true)
      const profile = toProfileView(res.data)
      setProfileData(profile)
      setEditForm(prev => ({ ...prev, ...profile }))
      alert("Avatar updated!")
    } catch {
      alert("Failed to upload avatar")
    } finally {
      setIsUpdating(false)
    }
  }

  const [showBannerModal, setShowBannerModal] = useState(false)
  const [selectedBannerTemp, setSelectedBannerTemp] = useState(null)
  const [activeBannerCat, setActiveBannerCat] = useState('Abstract')

  const BANNER_COLLECTIONS = {
    'Abstract': [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564',
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2564',
      'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2564',
      'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2564'
    ],
    'Tech': [
      'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2564',
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2564',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2564'
    ],
    'Nature': [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2564',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2564',
      'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=2564'
    ],
    'Finance': [
      'https://images.unsplash.com/photo-1611974714014-419b6727503c?q=80&w=2564',
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=2564'
    ]
  }

  const applyBanner = async () => {
    if (!selectedBannerTemp) return
    const user = auth.getUser()
    if (!user) return alert("Please log in again")

    setIsUpdating(true)
    try {
      const res = await apiRequest(`/users/${encodeURIComponent(user.uid)}`, { method: 'PUT', body: JSON.stringify({ bannerURL: selectedBannerTemp }) }, true)
      const profile = toProfileView(res.data)
      setProfileData(profile)
      setShowBannerModal(false)
      alert("Banner updated successfully!")
    } catch (err) {
      console.error("Banner update failed:", err)
      alert("Failed to update banner: " + err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUpdateProfile = async () => {
    const user = auth.getUser()
    if (!user) return alert("Please log in again")

    setIsUpdating(true)
    try {
      const res = await apiRequest(`/users/${encodeURIComponent(user.uid)}`, { method: 'PUT', body: JSON.stringify(toProfileUpdate(editForm)) }, true)
      const profile = toProfileView(res.data)
      setProfileData(profile)
      setEditForm(prev => ({ ...prev, ...profile }))
      setShowEditScreen(false)
      alert("Profile updated successfully!")
    } catch (err) {
      console.error("Profile update failed:", err)
      alert("Error: " + err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    alert("Profile link copied to clipboard!")
  }

  const [isFollowing, setIsFollowing] = useState(false)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.profile-sidebar', { x: -30, opacity: 0, duration: 0.8, ease: 'power3.out' })
      gsap.from('.portfolio-grid', { y: 30, opacity: 0, duration: 0.7, delay: 0.2, ease: 'power3.out' })
    }, containerRef)
    return () => ctx.revert()
  }, [loading])

  const name = profileData?.name || (isOwnProfile && currentUser?.name) || 'Unknown User'
  const handle = profileData?.handle || name.replace(/\s+/g,'').toLowerCase()
  const avatar = profileData?.avatar || (isOwnProfile && currentUser?.avatar) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileUid}`

  if (profileError) {
    return (
      <main className="min-h-screen bg-[#09090B] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-black">Profile unavailable</h1>
          <p className="text-sm text-[#888] mt-3">{profileError}</p>
          <button onClick={() => navigate('/')} className="mt-6 px-5 py-3 rounded-xl bg-[#0066FF] font-bold">Return home</button>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#09090B] text-white overflow-hidden" ref={containerRef}>
      <div className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? 'w-[78px]' : 'w-[240px]'}`}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-50 bg-[#09090B]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <span className="font-syne font-black text-white text-base">freelan<span className="text-[#0066FF]">so</span></span>
          <div className="flex items-center gap-2">
            {isOwnProfile && (
              <button onClick={() => setShowEditScreen(true)} className="text-[0.75rem] font-black text-[#0066FF] bg-[#0066FF]/10 border border-[#0066FF]/20 px-3 py-1.5 rounded-lg">Edit Profile</button>
            )}
          </div>
        </div>

        {/* Cover Photo */}
        <div className="h-[160px] md:h-[240px] w-full shrink-0 relative overflow-hidden bg-[#121216] group/banner">
          <img 
            src={profileData?.banner || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"} 
            className="w-full h-full object-cover opacity-80 group-hover/banner:scale-105 transition-transform duration-1000" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-transparent to-black/20" />
          
          {isOwnProfile && (
            <div className="absolute top-6 right-6 opacity-0 group-hover/banner:opacity-100 transition-opacity">
               <button 
                 onClick={() => setShowBannerModal(true)}
                 className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all cursor-pointer"
               >
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                 Choose Cover Image
               </button>
            </div>
          )}
        </div>

        {/* Content Split Layout */}
        <div className="max-w-[1400px] mx-auto w-full px-4 md:px-6 lg:px-10 flex flex-col md:flex-row gap-7 md:gap-10 relative z-10 -mt-16 md:-mt-20 pb-20">
          
          {/* LEFT SIDEBAR (Profile Info) */}
          <div className="profile-sidebar w-full md:w-[280px] shrink-0 flex flex-col">
             <div className="w-24 md:w-36 h-24 md:h-36 rounded-full border-4 border-[#09090B] overflow-hidden bg-[#121216] relative group">
                <Avatar 
                  src={avatar} 
                  name={name} 
                  size="w-full h-full" 
                  className="rounded-full" 
                />
                {isOwnProfile && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => document.getElementById('avatar-input').click()}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <input id="avatar-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={handleAvatarChange} />
                  </div>
                )}
             </div>
             
             <div className="mt-4 flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-syne font-black text-white">{name}</h1>
                <span className="text-[#0066FF] text-[10px] font-black bg-[#0066FF]/10 px-2 py-1 rounded-md tracking-wider">@{handle}</span>
             </div>
             
             <p className="text-[#888] text-sm mt-4 leading-relaxed font-medium">
               {profileData?.bio || "No professional bio available yet."}
             </p>

             <div className="flex items-center justify-between mt-10 mb-10 text-center px-2">
                <div>
                   <div className="text-xl font-black text-[#0066FF]">{isFollowing ? 1 : 0}</div>
                   <div className="text-[10px] uppercase tracking-widest text-[#666] font-bold mt-1">Followers</div>
                </div>
                <div>
                   <div className="text-xl font-black text-[#0066FF]">0</div>
                   <div className="text-[10px] uppercase tracking-widest text-[#666] font-bold mt-1">Following</div>
                </div>
                <div>
                   <div className="text-xl font-black text-[#0066FF]">1</div>
                   <div className="text-[10px] uppercase tracking-widest text-[#666] font-bold mt-1">Portfolio</div>
                </div>
             </div>

             {!isOwnProfile ? (
               <div className="flex flex-col gap-2">
                 <button
                   onClick={() => setIsFollowing(!isFollowing)}
                   className={`w-full py-3.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${isFollowing ? 'bg-white/10 text-white' : 'bg-[#0066FF] text-white hover:scale-[1.02] active:scale-[0.98]'}`}
                 >
                   {isFollowing ? 'Following ✓' : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Follow</>}
                 </button>
                 <button
                   onClick={handleMessageProfile}
                   className="w-full py-3.5 rounded-xl bg-white/5 border border-white/5 font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                 >
                   Message
                 </button>
               </div>
             ) : (
               <div className="flex flex-col gap-2">
                 <button onClick={() => setShowEditScreen(true)} className="w-full py-3.5 rounded-xl bg-white/5 font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5">
                   Edit Profile
                 </button>
                 <button onClick={handleShare} className="w-full py-3.5 rounded-xl bg-[#0066FF] text-white font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all">
                   Share Profile
                 </button>
               </div>
             )}
          </div>

          {/* RIGHT MAIN CONTENT */}
          <div className="portfolio-grid flex-1 min-w-0 pt-6 md:pt-20">
             {/* Dynamic Tab Bar */}
             <div className="flex flex-wrap gap-2 bg-[#121216] p-1.5 rounded-[20px] w-fit mb-8 border border-white/5 shadow-xl">
                {['Posts', 'Services', 'About'].map(tab => {
                   const isActive = activeTab === tab;
                   let count = '';
                   if (tab === 'Posts') count = myProjects.length;
                   if (tab === 'Services') count = myServices.length;

                   return (
                     <button 
                       key={tab} 
                       onClick={() => setActiveTab(tab)}
                       className={`px-6 py-2.5 rounded-[14px] text-sm font-bold transition-all ${isActive ? 'bg-[#0066FF] text-white shadow-lg scale-105' : 'text-[#888] hover:text-white hover:bg-white/5'}`}
                     >
                       {tab} {count !== '' && `(${count})`}
                     </button>
                   )
                })}
             </div>

             {/* Tab Content Areas */}
             {activeTab === 'Posts' && (
                <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
                   {myProjects.map(p => <div key={p.id} className="break-inside-avoid"><ProjectCard project={p} /></div>)}
                   {myProjects.length === 0 && (
                     <div className="col-span-full py-20 text-center text-[#555] font-bold">No posts available.</div>
                   )}
                </div>
             )}

             {activeTab === 'Services' && (
                <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
                   {myServices.map(s => <div key={s.id} className="break-inside-avoid"><ProjectCard project={{...s, imageUrl: s.image}} /></div>)}
                </div>
             )}

             {activeTab === 'About' && (
                <div className="bg-[#121216] border border-white/5 rounded-[32px] p-8 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h3 className="text-2xl font-black mb-6 border-b border-white/5 pb-4">About Me</h3>
                  <p className="text-[#888] leading-relaxed mb-8 whitespace-pre-wrap">{profileData?.bio || "No professional bio available yet."}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div>
                        <h4 className="text-[10px] font-black uppercase text-[#555] tracking-widest mb-4">Location & Contact</h4>
                        <ul className="space-y-3 text-sm font-bold text-white">
                           {profileData?.city && profileData?.country ? <li>📍 {profileData.city}, {profileData.country}</li> : null}
                           {profileData?.email && <li>✉️ {profileData.email}</li>}
                           {profileData?.phone && <li>📞 {profileData.phone}</li>}
                        </ul>
                     </div>
                     <div>
                        <h4 className="text-[10px] font-black uppercase text-[#555] tracking-widest mb-4">Skills</h4>
                        <div className="flex flex-wrap gap-2">
                           {(profileData?.skills || []).map((s,i) => (
                             <span key={i} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold text-[#00D084]">{s}</span>
                           ))}
                        </div>
                     </div>
                  </div>
                </div>
             )}
          </div>
        </div>

        {/* MODALS */}
        {showBannerModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
             <div className="bg-white text-black w-full max-w-[900px] h-[600px] rounded-[32px] overflow-hidden flex flex-col shadow-2xl scale-in">
                {/* Modal Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#0066FF]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Choose Cover Image</h2>
                        <p className="text-xs text-gray-400 font-medium">Pick a banner that represents you</p>
                      </div>
                   </div>
                   <button onClick={() => setShowBannerModal(false)} className="text-gray-400 hover:text-black transition-colors">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                   </button>
                </div>

                {/* Modal Content container */}
                <div className="flex-1 flex overflow-hidden">
                   {/* Sidebar Categories */}
                   <div className="w-[220px] border-r border-gray-100 p-4 space-y-1 overflow-y-auto">
                      {Object.keys(BANNER_COLLECTIONS).map(cat => (
                        <button 
                          key={cat}
                          onClick={() => setActiveBannerCat(cat)}
                          className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all transition-all flex items-center justify-between ${activeBannerCat === cat ? 'bg-[#0066FF] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                          {cat}
                          <span className={`${activeBannerCat === cat ? 'bg-white/20' : 'bg-gray-100'} px-2 py-0.5 rounded-md text-[10px]`}>
                            {BANNER_COLLECTIONS[cat].length}
                          </span>
                        </button>
                      ))}
                   </div>

                   {/* Grid Content */}
                   <div className="flex-1 p-8 overflow-y-auto bg-gray-50/50">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">{activeBannerCat} • {BANNER_COLLECTIONS[activeBannerCat].length} Banners</h4>
                      <div className="grid grid-cols-2 gap-4">
                         {BANNER_COLLECTIONS[activeBannerCat].map((url, i) => (
                           <div 
                             key={i} 
                             onClick={() => setSelectedBannerTemp(url)}
                             className={`relative aspect-video rounded-2xl overflow-hidden cursor-pointer border-4 transition-all ${selectedBannerTemp === url ? 'border-[#0066FF] scale-[0.98]' : 'border-transparent hover:scale-[1.02]'}`}
                           >
                              <img src={url} className="w-full h-full object-cover" />
                              {selectedBannerTemp === url && (
                                <div className="absolute top-2 right-2 w-6 h-6 bg-[#0066FF] text-white rounded-full flex items-center justify-center shadow-lg">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>
                                </div>
                              )}
                           </div>
                         ))}
                      </div>
                   </div>
                </div>

                {/* Modal Footer */}
                <div className="px-8 py-6 border-t border-gray-100 flex items-center justify-between bg-white">
                   <p className="text-xs font-bold text-gray-400">{selectedBannerTemp ? '1 image selected' : 'No image selected'}</p>
                   <div className="flex items-center gap-3">
                      <button onClick={() => setShowBannerModal(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all border border-gray-100">Cancel</button>
                      <button 
                        onClick={applyBanner}
                        disabled={!selectedBannerTemp || isUpdating}
                        className="px-8 py-2.5 rounded-xl text-sm font-bold bg-[#0066FF] text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isUpdating ? 'Applying...' : '✓ Apply Cover'}
                      </button>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* FULL SCREEN EDIT PROFILE MODAL */}
        {showEditScreen && (
          <div className="fixed inset-0 z-[300] bg-[#09090B] overflow-y-auto animate-in slide-in-from-bottom duration-300 pb-20">
            <div className="max-w-[800px] mx-auto px-6 py-8">
               {/* Modal Header */}
               <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                   <button onClick={() => setShowEditScreen(false)} className="w-10 h-10 rounded-xl bg-[#121216] border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                   </button>
                   <h1 className="text-lg font-black uppercase tracking-widest text-white">Edit Profile</h1>
                 </div>
               </div>

               {/* Top Tabs */}
               <div className="grid grid-cols-4 gap-2 mb-8">
                  {['Identity', 'Location', 'Skills', 'Experience'].map(tab => (
                    <button 
                      key={tab} 
                      onClick={() => setEditTab(tab)}
                      className={`py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${editTab === tab ? 'bg-[#0066FF]/20 text-[#0066FF] ring-1 ring-[#0066FF]/50' : 'bg-[#121216] text-[#888] hover:bg-white/5 border border-white/5'}`}
                    >
                      {editTab === tab && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                      {tab}
                    </button>
                  ))}
               </div>

               {/* Form Content Wrapper */}
               <div className="bg-[#121216] border border-white/5 rounded-[32px] p-8 md:p-10 shadow-2xl">
                 
                 {editTab === 'Identity' && (
                   <div className="space-y-8 animate-in fade-in duration-300">
                     <div className="flex flex-col md:flex-row items-start md:items-center gap-6 pb-8 border-b border-white/5">
                        <div className="w-24 h-24 rounded-3xl overflow-hidden relative group cursor-pointer bg-[#1A1A1F] shrink-0">
                          <img src={avatar} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          </div>
                        </div>
                         <div>
                          <h3 className="font-bold text-lg text-white">Profile Photo</h3>
                          <p className="text-[#666] text-[10px] font-black mt-1 uppercase tracking-widest">JPG, PNG, GIF or WebP · Max 5MB</p>
                          <button className="text-[#0066FF] text-xs font-bold mt-2 hover:underline tracking-wider" onClick={() => document.getElementById('avatar-input').click()}>Upload new photo ➔</button>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row gap-6">
                         <div className="flex-1">
                           <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center justify-between">
                             Email Address <span>🔒 LOCKED</span>
                           </label>
                           <input disabled value={profileData?.email || currentUser?.email || ''} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 text-[#444] cursor-not-allowed font-medium text-sm" />
                         </div>
                         <div className="flex-1">
                           <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center justify-between">
                             Phone Number <span className="lowercase font-normal text-[#444]">(optional)</span>
                           </label>
                           <input value={editForm.phone} onChange={e=>setEditForm({...editForm, phone: e.target.value})} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 focus:border-[#0066FF] outline-none font-medium text-white text-sm transition-all" placeholder="+91 98765 43210" />
                         </div>
                       </div>
                       
                       <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center gap-1">
                           Full Name <span className="text-[#0066FF]">*</span>
                         </label>
                         <input value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 focus:border-[#0066FF] outline-none font-medium text-white text-sm transition-all" placeholder="John Doe" />
                       </div>
                       <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center justify-between">
                           Username <span className="text-[#0066FF]">*</span>
                         </label>
                         <input value={editForm.handle} onChange={e=>setEditForm({...editForm, handle: e.target.value})} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 focus:border-[#0066FF] outline-none font-medium text-white text-sm transition-all" placeholder="@your_username" />
                       </div>

                       <div className="col-span-1 md:col-span-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center justify-between">
                           Professional Title <span className="lowercase font-normal text-[#444]">(optional)</span>
                         </label>
                         <input value={editForm.role} onChange={e=>setEditForm({...editForm, role: e.target.value})} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 focus:border-[#0066FF] outline-none font-medium text-white text-sm transition-all" placeholder="e.g. Full Stack Developer" />
                       </div>

                       <div className="col-span-1 md:col-span-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center justify-between">
                           Bio <span className="lowercase font-normal text-[#444]">(optional)</span>
                         </label>
                         <textarea value={editForm.bio} onChange={e=>setEditForm({...editForm, bio: e.target.value})} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 focus:border-[#0066FF] outline-none font-medium text-white text-sm transition-all h-32 resize-none" placeholder="Tell us about yourself..." />
                       </div>
                     </div>

                     <div className="flex gap-4 pt-4 border-t border-white/5">
                        <button disabled className="flex-1 py-4 bg-[#0A0A0C] border border-white/5 text-[#555] rounded-xl font-black uppercase text-xs cursor-not-allowed">Previous</button>
                        <button onClick={() => setEditTab('Location')} className="flex-1 py-4 bg-[#0066FF] text-white rounded-xl font-black uppercase text-xs flex justify-center items-center gap-2 hover:scale-[1.02] transition-transform shadow-lg">Continue <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg></button>
                     </div>
                   </div>
                 )}

                 {editTab === 'Location' && (
                   <div className="space-y-6 animate-in fade-in duration-300">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="md:col-span-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center justify-between">Country <span className="text-[#444] lowercase">(optional)</span></label>
                         <input value={editForm.country} onChange={e=>setEditForm({...editForm, country: e.target.value})} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 focus:border-[#0066FF] outline-none font-medium text-white text-sm" placeholder="Select country" />
                       </div>
                       <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center justify-between">State <span className="text-[#444] lowercase">(optional)</span></label>
                         <input value={editForm.state} onChange={e=>setEditForm({...editForm, state: e.target.value})} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 focus:border-[#0066FF] outline-none font-medium text-white text-sm" placeholder="Pick country first" />
                       </div>
                       <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center justify-between">City <span className="text-[#444] lowercase">(optional)</span></label>
                         <input value={editForm.city} onChange={e=>setEditForm({...editForm, city: e.target.value})} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 focus:border-[#0066FF] outline-none font-medium text-white text-sm" placeholder="City name" />
                       </div>
                       <div className="md:col-span-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center justify-between">Address Line 1 <span className="text-[#444] lowercase">(optional)</span></label>
                         <input value={editForm.address1} onChange={e=>setEditForm({...editForm, address1: e.target.value})} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 focus:border-[#0066FF] outline-none font-medium text-white text-sm" placeholder="Street, P.O. box" />
                       </div>
                       <div className="md:col-span-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center justify-between">Address Line 2 <span className="text-[#444] lowercase">(optional)</span></label>
                         <input value={editForm.address2} onChange={e=>setEditForm({...editForm, address2: e.target.value})} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 focus:border-[#0066FF] outline-none font-medium text-white text-sm" placeholder="Apt, suite, unit" />
                       </div>
                       <div className="md:col-span-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#666] mb-2 flex items-center justify-between">Pincode <span className="text-[#444] lowercase">(optional)</span></label>
                         <input value={editForm.pincode} onChange={e=>setEditForm({...editForm, pincode: e.target.value})} className="w-full bg-[#0A0A0C] border border-white/5 rounded-xl p-4 focus:border-[#0066FF] outline-none font-medium text-white text-sm" placeholder="Postal code" />
                       </div>
                     </div>
                     <div className="flex gap-4 pt-4 border-t border-white/5">
                        <button onClick={() => setEditTab('Identity')} className="flex-1 py-4 bg-[#0A0A0C] border border-white/5 text-white hover:bg-white/5 transition-colors rounded-xl font-black uppercase text-xs">Previous</button>
                        <button onClick={() => setEditTab('Skills')} className="flex-1 py-4 bg-[#0066FF] text-white rounded-xl font-black uppercase text-xs flex justify-center items-center gap-2 hover:scale-[1.02] transition-transform shadow-lg">Continue <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg></button>
                     </div>
                   </div>
                 )}

                 {editTab === 'Skills' && (
                   <div className="space-y-8 animate-in fade-in duration-300">
                     <div>
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-[#888] flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0066FF" strokeWidth="2"><path d="M12 2l3 6 7 1-5 4 1 7-6-3-6 3 1-7-5-4 7-1 3-6z"/></svg> Skills & Tools</h4>
                         <button onClick={() => setShowSkillModal(true)} className="px-3 py-1.5 rounded-lg border border-[#0066FF]/30 text-[#0066FF] text-xs font-bold hover:bg-[#0066FF] hover:text-white transition-colors flex items-center gap-1">+ Add Skill</button>
                       </div>
                       
                       {editForm.skills?.length > 0 ? (
                         <div className="flex flex-wrap gap-2 p-4 bg-[#0A0A0C] border border-white/5 rounded-2xl min-h-[80px]">
                           {editForm.skills.map((s, i) => (
                             <span key={i} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold text-[#0066FF] flex items-center gap-2">
                               {s}
                               <button onClick={() => setEditForm(prev => ({...prev, skills: prev.skills.filter((_, idx) => idx !== i)}))} className="text-[#888] hover:text-white transition-colors">✕</button>
                             </span>
                           ))}
                         </div>
                       ) : (
                         <div className="w-full bg-[#0A0A0C] border border-dashed border-white/10 rounded-2xl h-32 flex flex-col items-center justify-center text-center">
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" className="mb-2"><path d="M12 2v20M2 12h20M12 4a8 8 0 0 0 0 16"/></svg>
                           <p className="text-[#666] text-sm font-medium">No skills yet — click Add Skill</p>
                         </div>
                       )}
                     </div>

                     <div>
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-[#888] flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0066FF" strokeWidth="2"><path d="M4 5h16v14H4z M12 5v14 M4 12h16"/></svg> Languages</h4>
                         <button onClick={() => setEditForm(prev => ({...prev, languages: [...(prev.languages || []), {lang: '', proficiency: ''}]}))} className="px-3 py-1.5 rounded-lg border border-[#0066FF]/30 text-[#0066FF] text-xs font-bold hover:bg-[#0066FF] hover:text-white transition-colors flex items-center gap-1">+ Add</button>
                       </div>
                       
                       {editForm.languages?.length > 0 ? (
                         <div className="space-y-3">
                           {editForm.languages.map((l, i) => (
                             <div key={i} className="flex items-center gap-3">
                               <select value={l.lang} onChange={e => {
                                  let newLangs = [...editForm.languages]; newLangs[i].lang = e.target.value; setEditForm({...editForm, languages: newLangs});
                               }} className="flex-1 bg-[#09090b] border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-[#0066FF]">
                                 <option value="">Language</option>
                                 <option value="English">English</option>
                                 <option value="Spanish">Spanish</option>
                                 <option value="French">French</option>
                                 <option value="German">German</option>
                                 <option value="Hindi">Hindi</option>
                                 <option value="Mandarin">Mandarin</option>
                               </select>
                               <select value={l.proficiency} onChange={e => {
                                  let newLangs = [...editForm.languages]; newLangs[i].proficiency = e.target.value; setEditForm({...editForm, languages: newLangs});
                               }} className="bg-[#09090b] border border-white/10 rounded-xl p-3 text-sm text-[#888] outline-none w-[150px] focus:border-[#0066FF]">
                                 <option value="">Proficiency</option>
                                 <option value="Beginner">Beginner</option>
                                 <option value="Intermediate">Intermediate</option>
                                 <option value="Fluent">Fluent</option>
                                 <option value="Native">Native</option>
                               </select>
                               <button onClick={() => {
                                  let newLangs = editForm.languages.filter((_, idx)=>idx!==i); setEditForm({...editForm, languages: newLangs});
                               }} className="w-[46px] h-[46px] shrink-0 flex items-center justify-center border border-red-500/20 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors">
                                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                               </button>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <div className="w-full bg-[#0A0A0C] border border-dashed border-white/10 rounded-2xl h-32 flex flex-col items-center justify-center text-center">
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" className="mb-2"><path d="M4 5h16v14H4z M12 5v14 M4 12h16"/></svg>
                           <p className="text-[#666] text-sm font-medium">Add languages you speak</p>
                         </div>
                       )}
                     </div>
                     <div className="flex gap-4 pt-4 border-t border-white/5">
                        <button onClick={() => setEditTab('Location')} className="flex-1 py-4 bg-[#0A0A0C] border border-white/5 text-white hover:bg-white/5 transition-colors rounded-xl font-black uppercase text-xs">Previous</button>
                        <button onClick={() => setEditTab('Experience')} className="flex-1 py-4 bg-[#0066FF] text-white rounded-xl font-black uppercase text-xs flex justify-center items-center gap-2 hover:scale-[1.02] transition-transform shadow-lg">Continue <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg></button>
                     </div>
                   </div>
                 )}

                 {editTab === 'Experience' && (
                   <div className="space-y-8 animate-in fade-in duration-300">
                     {/* WORK EXPERIENCE */}
                     <div>
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="text-[10px] font-black uppercase text-[#888] tracking-widest flex items-center gap-2">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0066FF" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> WORK EXPERIENCE
                         </h4>
                         <button onClick={() => setShowExpModal(true)} className="px-3 py-1.5 rounded-lg border border-[#0066FF]/30 text-[#0066FF] text-xs font-bold hover:bg-[#0066FF] hover:text-white transition-colors flex items-center gap-1">+ Add</button>
                       </div>
                       {editForm.experience?.length > 0 ? (
                         <div className="space-y-3">
                           {editForm.experience.map((exp, i) => (
                             <div key={i} className="flex justify-between items-start bg-[#0A0A0C] border border-white/5 rounded-2xl p-4">
                               <div>
                                 <h5 className="font-bold text-white text-sm">{exp.title}</h5>
                                 <p className="text-xs text-[#888] mt-1">{exp.company} • {exp.startMonth} {exp.startYear} - {exp.isCurrent ? 'Present' : `${exp.endMonth} ${exp.endYear}`}</p>
                                 {(exp.city || exp.country) && <p className="text-xs text-[#666] mt-1">{exp.city}{exp.city && exp.country ? ', ' : ''}{exp.country}</p>}
                               </div>
                               <button onClick={() => setEditForm(prev => ({...prev, experience: prev.experience.filter((_, idx) => idx !== i)}))} className="text-[#888] hover:text-red-500 transition-colors">✕</button>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <div className="w-full bg-[#0A0A0C] border border-dashed border-white/10 rounded-2xl h-28 flex flex-col items-center justify-center text-center">
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" className="mb-2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                           <p className="text-[#666] text-sm font-medium">Add your work history</p>
                         </div>
                       )}
                     </div>

                     {/* EDUCATION */}
                     <div>
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="text-[10px] font-black uppercase text-[#888] tracking-widest flex items-center gap-2">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0066FF" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> EDUCATION
                         </h4>
                         <button onClick={() => setShowEduModal(true)} className="px-3 py-1.5 rounded-lg border border-[#0066FF]/30 text-[#0066FF] text-xs font-bold hover:bg-[#0066FF] hover:text-white transition-colors flex items-center gap-1">+ Add</button>
                       </div>
                       {editForm.education?.length > 0 ? (
                         <div className="space-y-3">
                           {editForm.education.map((edu, i) => (
                             <div key={i} className="flex justify-between items-start bg-[#0A0A0C] border border-white/5 rounded-2xl p-4">
                               <div>
                                 <h5 className="font-bold text-white text-sm">{edu.school}</h5>
                                 <p className="text-xs text-[#888] mt-1">{edu.degree ? `${edu.degree} in ` : ''}{edu.field} ({edu.startYear} - {edu.endYear})</p>
                               </div>
                               <button onClick={() => setEditForm(prev => ({...prev, education: prev.education.filter((_, idx) => idx !== i)}))} className="text-[#888] hover:text-red-500 transition-colors">✕</button>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <div className="w-full bg-[#0A0A0C] border border-dashed border-white/10 rounded-2xl h-28 flex flex-col items-center justify-center text-center">
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" className="mb-2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                           <p className="text-[#666] text-sm font-medium">Add education</p>
                         </div>
                       )}
                     </div>

                     {/* CERTIFICATIONS */}
                     <div>
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="text-[10px] font-black uppercase text-[#888] tracking-widest flex items-center gap-2">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0066FF" strokeWidth="2"><path d="M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg> CERTIFICATIONS
                         </h4>
                         <button onClick={() => setShowCertModal(true)} className="px-3 py-1.5 rounded-lg border border-[#0066FF]/30 text-[#0066FF] text-xs font-bold hover:bg-[#0066FF] hover:text-white transition-colors flex items-center gap-1">+ Add</button>
                       </div>
                       {editForm.certifications?.length > 0 ? (
                         <div className="space-y-3">
                           {editForm.certifications.map((cert, i) => (
                             <div key={i} className="flex justify-between items-start bg-[#0A0A0C] border border-white/5 rounded-2xl p-4">
                               <div>
                                 <h5 className="font-bold text-white text-sm">{cert.name}</h5>
                                 <p className="text-xs text-[#888] mt-1">{cert.issuer} {cert.year && `• ${cert.year}`}</p>
                               </div>
                               <button onClick={() => setEditForm(prev => ({...prev, certifications: prev.certifications.filter((_, idx) => idx !== i)}))} className="text-[#888] hover:text-red-500 transition-colors">✕</button>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <div className="w-full bg-[#0A0A0C] border border-dashed border-white/10 rounded-2xl h-28 flex flex-col items-center justify-center text-center">
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" className="mb-2"><path d="M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>
                           <p className="text-[#666] text-sm font-medium">Add certifications</p>
                         </div>
                       )}
                     </div>
                     <div className="flex gap-4 pt-4 border-t border-white/5">
                        <button onClick={() => setEditTab('Skills')} className="flex-1 py-4 bg-[#0A0A0C] border border-white/5 text-white hover:bg-white/5 transition-colors rounded-xl font-black uppercase text-xs">Previous</button>
                        <button onClick={handleUpdateProfile} disabled={isUpdating} className="flex-1 py-4 bg-[#0066FF] text-white rounded-xl font-black uppercase text-xs flex justify-center items-center gap-2 hover:scale-[1.02] transition-transform shadow-lg disabled:opacity-50">
                           {isUpdating ? 'Saving...' : '✓ Finish & Save'}
                        </button>
                     </div>
                   </div>
                 )}
               </div>
            </div>
          </div>
        )}

        {/* ADD SKILL MODAL */}
        {showSkillModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#121216] border border-white/10 rounded-[32px] w-full max-w-[500px] overflow-hidden text-white animate-in zoom-in-95 duration-200 shadow-2xl">
              <div className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                <h3 className="text-xl font-black uppercase tracking-widest text-white">Add Skill</h3>
                <button onClick={() => setShowSkillModal(false)} className="text-[#888] hover:text-white transition-colors rounded-full p-2 hover:bg-white/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                   <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Category <span className="text-[#0066FF]">*</span></label>
                   <select 
                     value={skillForm.category} 
                     onChange={e => setSkillForm({...skillForm, category: e.target.value, tool: ''})}
                     className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium"
                   >
                     <option value="" disabled>Select a category</option>
                     <option value="Development">Development</option>
                     <option value="Design">Design</option>
                     <option value="Marketing">Marketing</option>
                     <option value="Other">Other</option>
                   </select>
                </div>
                <div>
                   <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Tool <span className="text-[#0066FF]">*</span></label>
                   <select 
                     disabled={!skillForm.category}
                     value={skillForm.tool} 
                     onChange={e => setSkillForm({...skillForm, tool: e.target.value})}
                     className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm disabled:opacity-50 text-white font-medium disabled:text-[#666]"
                   >
                     <option value="" disabled>{skillForm.category ? 'Select a tool' : 'Select category first'}</option>
                     <option value="React">React</option>
                     <option value="Figma">Figma</option>
                     <option value="Node.js">Node.js</option>
                     <option value="Python">Python</option>
                     <option value="Photoshop">Photoshop</option>
                     <option value="General Frontend">General Frontend</option>
                   </select>
                </div>
                <div>
                   <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Skills <span className="text-[#0066FF]">*</span></label>
                   <input 
                     disabled={!skillForm.tool}
                     value={skillForm.skillName}
                     onChange={e => setSkillForm({...skillForm, skillName: e.target.value})}
                     type="text"
                     placeholder={!skillForm.tool ? "Select category and tool first" : "e.g. Frontend Architecture"}
                     className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm disabled:opacity-50 text-white font-medium placeholder-[#555] disabled:placeholder-[#444]"
                   />
                </div>
                
                {!skillForm.category && (
                  <p className="text-[#0066FF] text-xs font-bold flex items-center gap-2"><span className="text-lg">👆</span> Select a category first</p>
                )}
                
                <div className="bg-[#0066FF]/10 border border-[#0066FF]/20 rounded-xl p-4 text-sm text-[#0066FF] flex items-center gap-2">
                   <span className="font-black uppercase tracking-widest text-[10px]">How it works:</span> Choose a category, select a tool, then add your skills.
                </div>
              </div>
              <div className="p-6 border-t border-white/5 flex items-center justify-end gap-4 bg-white/5">
                 <button onClick={() => setShowSkillModal(false)} className="px-6 py-3 rounded-xl border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors">Cancel</button>
                 <button onClick={() => {
                   if(skillForm.skillName) {
                     setEditForm(prev => ({...prev, skills: [...(prev.skills||[]), skillForm.skillName]}));
                     setShowSkillModal(false);
                     setSkillForm({category: '', tool: '', skillName: ''});
                   }
                 }} className="px-6 py-3 rounded-xl bg-[#0066FF] text-white font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-lg">Save Skill</button>
              </div>
            </div>
          </div>
        )}

        {/* ADD EXPERIENCE MODAL */}
        {showExpModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 mb-20 bg-black/80 backdrop-blur-sm overflow-y-auto pt-32 pb-10">
            <div className="bg-[#121216] border border-white/10 rounded-[32px] w-full max-w-[600px] overflow-hidden text-white animate-in zoom-in-95 duration-200 shadow-2xl">
              <div className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                <h3 className="text-xl font-black uppercase tracking-widest text-white">Add Experience</h3>
                <button onClick={() => setShowExpModal(false)} className="text-[#888] hover:text-white transition-colors rounded-full p-2 hover:bg-white/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Job Title <span className="text-[#0066FF]">*</span></label>
                       <input value={expForm.title} onChange={e => setExpForm({...expForm, title: e.target.value})} type="text" placeholder="e.g. Senior Designer" className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium" />
                    </div>
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Company <span className="text-[#0066FF]">*</span></label>
                       <input value={expForm.company} onChange={e => setExpForm({...expForm, company: e.target.value})} type="text" placeholder="Company name" className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium" />
                    </div>
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">City <span className="lowercase font-normal text-[#555]">(optional)</span></label>
                       <input value={expForm.city} onChange={e => setExpForm({...expForm, city: e.target.value})} type="text" placeholder="City" className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium" />
                    </div>
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Country <span className="lowercase font-normal text-[#555]">(optional)</span></label>
                       <input value={expForm.country} onChange={e => setExpForm({...expForm, country: e.target.value})} type="text" placeholder="Country" className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium" />
                    </div>
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Start Month</label>
                       <select value={expForm.startMonth} onChange={e => setExpForm({...expForm, startMonth: e.target.value})} className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium">
                          <option value="">Month</option><option value="Jan">Jan</option><option value="Feb">Feb</option><option value="Mar">Mar</option><option value="Apr">Apr</option><option value="May">May</option><option value="Jun">Jun</option><option value="Jul">Jul</option><option value="Aug">Aug</option><option value="Sep">Sep</option><option value="Oct">Oct</option><option value="Nov">Nov</option><option value="Dec">Dec</option>
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Start Year</label>
                       <select value={expForm.startYear} onChange={e => setExpForm({...expForm, startYear: e.target.value})} className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium">
                          <option value="">Year</option>
                          {Array.from({length: 30}, (_,i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="flex items-center justify-between bg-[#0A0A0C] border border-white/5 rounded-xl p-4 cursor-pointer" onClick={() => setExpForm({...expForm, isCurrent: !expForm.isCurrent})}>
                    <div>
                       <h4 className="text-sm font-bold text-white">I currently work here</h4>
                       <p className="text-xs text-[#666] mt-1">Check if this is your current role</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${expForm.isCurrent ? 'bg-[#0066FF]' : 'bg-white/10'}`}>
                       <div className={`w-4 h-4 rounded-full bg-white transition-transform ${expForm.isCurrent ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                 </div>

                 {!expForm.isCurrent && (
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">End Month</label>
                         <select value={expForm.endMonth} onChange={e => setExpForm({...expForm, endMonth: e.target.value})} className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium">
                            <option value="">Month</option><option value="Jan">Jan</option><option value="Feb">Feb</option><option value="Mar">Mar</option><option value="Apr">Apr</option><option value="May">May</option><option value="Jun">Jun</option><option value="Jul">Jul</option><option value="Aug">Aug</option><option value="Sep">Sep</option><option value="Oct">Oct</option><option value="Nov">Nov</option><option value="Dec">Dec</option>
                         </select>
                      </div>
                      <div>
                         <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">End Year</label>
                         <select value={expForm.endYear} onChange={e => setExpForm({...expForm, endYear: e.target.value})} className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium">
                            <option value="">Year</option>
                            {Array.from({length: 30}, (_,i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                         </select>
                      </div>
                   </div>
                 )}

                 <div>
                    <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Description <span className="lowercase font-normal text-[#555]">(optional)</span></label>
                    <textarea value={expForm.description} onChange={e => setExpForm({...expForm, description: e.target.value})} placeholder="What did you do in this role?" className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium h-24 resize-none" />
                 </div>
              </div>
              <div className="p-6 border-t border-white/5 flex items-center justify-end gap-4 bg-white/5">
                 <button onClick={() => setShowExpModal(false)} className="px-6 py-3 rounded-xl border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors">Cancel</button>
                 <button onClick={() => {
                   if(expForm.title && expForm.company) {
                     setEditForm(prev => ({...prev, experience: [...(prev.experience||[]), expForm]}));
                     setShowExpModal(false);
                     setExpForm({ title: '', company: '', city: '', country: '', startMonth: '', startYear: '', isCurrent: false, endMonth: '', endYear: '', description: '' });
                   } else { alert("Job Title and Company are required.") }
                 }} className="px-8 py-3 rounded-xl bg-[#0066FF] text-white font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-lg">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* ADD EDUCATION MODAL */}
        {showEduModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm overflow-y-auto pt-32 pb-10">
            <div className="bg-[#121216] border border-white/10 rounded-[32px] w-full max-w-[600px] overflow-hidden text-white animate-in zoom-in-95 duration-200 shadow-2xl">
              <div className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                <h3 className="text-xl font-black uppercase tracking-widest text-white">Add Education</h3>
                <button onClick={() => setShowEduModal(false)} className="text-[#888] hover:text-white transition-colors rounded-full p-2 hover:bg-white/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-8 space-y-6">
                 <div>
                    <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">School <span className="text-[#0066FF]">*</span></label>
                    <input value={eduForm.school} onChange={e => setEduForm({...eduForm, school: e.target.value})} type="text" placeholder="University or school name" className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Degree <span className="lowercase font-normal text-[#555]">(optional)</span></label>
                       <input value={eduForm.degree} onChange={e => setEduForm({...eduForm, degree: e.target.value})} type="text" placeholder="B.S., MBA, High School..." className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium" />
                    </div>
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Field of Study <span className="lowercase font-normal text-[#555]">(optional)</span></label>
                       <input value={eduForm.field} onChange={e => setEduForm({...eduForm, field: e.target.value})} type="text" placeholder="Computer Science, Business..." className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium" />
                    </div>
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Start Year</label>
                       <select value={eduForm.startYear} onChange={e => setEduForm({...eduForm, startYear: e.target.value})} className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium">
                          <option value="">Year</option>
                          {Array.from({length: 40}, (_,i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">End Year</label>
                       <select value={eduForm.endYear} onChange={e => setEduForm({...eduForm, endYear: e.target.value})} className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium">
                          <option value="">Year</option>
                          {Array.from({length: 40}, (_,i) => new Date().getFullYear() + 10 - i).map(y => <option key={y} value={y}>{y}</option>)}
                       </select>
                    </div>
                 </div>

                 <div>
                    <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Description <span className="lowercase font-normal text-[#555]">(optional)</span></label>
                    <textarea value={eduForm.description} onChange={e => setEduForm({...eduForm, description: e.target.value})} placeholder="Activities, honors, achievements..." className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium h-24 resize-none" />
                 </div>
              </div>
              <div className="p-6 border-t border-white/5 flex items-center justify-end gap-4 bg-white/5">
                 <button onClick={() => setShowEduModal(false)} className="px-6 py-3 rounded-xl border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors">Cancel</button>
                 <button onClick={() => {
                   if(eduForm.school) {
                     setEditForm(prev => ({...prev, education: [...(prev.education||[]), eduForm]}));
                     setShowEduModal(false);
                     setEduForm({ school: '', degree: '', field: '', startYear: '', endYear: '', description: '' });
                   } else { alert("School name is required.") }
                 }} className="px-8 py-3 rounded-xl bg-[#0066FF] text-white font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-lg">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* ADD CERTIFICATION MODAL */}
        {showCertModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="bg-[#121216] border border-white/10 rounded-[32px] w-full max-w-[600px] overflow-hidden text-white animate-in zoom-in-95 duration-200 shadow-2xl">
              <div className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                <h3 className="text-xl font-black uppercase tracking-widest text-white">Add Certification</h3>
                <button onClick={() => setShowCertModal(false)} className="text-[#888] hover:text-white transition-colors rounded-full p-2 hover:bg-white/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-8 space-y-6">
                 <div>
                    <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Certification Name <span className="text-[#0066FF]">*</span></label>
                    <input value={certForm.name} onChange={e => setCertForm({...certForm, name: e.target.value})} type="text" placeholder="AWS Solutions Architect, PMP..." className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Issuing Organization <span className="lowercase font-normal text-[#555]">(optional)</span></label>
                       <input value={certForm.issuer} onChange={e => setCertForm({...certForm, issuer: e.target.value})} type="text" placeholder="Amazon Web Services, PMI..." className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium" />
                    </div>
                    <div>
                       <label className="text-[10px] uppercase tracking-widest text-[#888] font-black block mb-2">Year <span className="lowercase font-normal text-[#555]">(optional)</span></label>
                       <select value={certForm.year} onChange={e => setCertForm({...certForm, year: e.target.value})} className="w-full border border-white/5 bg-[#09090b] rounded-xl p-3 outline-none focus:border-[#0066FF] text-sm text-white font-medium">
                          <option value="">Year</option>
                          {Array.from({length: 30}, (_,i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                       </select>
                    </div>
                 </div>
              </div>
              <div className="p-6 border-t border-white/5 flex items-center justify-end gap-4 bg-white/5">
                 <button onClick={() => setShowCertModal(false)} className="px-6 py-3 rounded-xl border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors">Cancel</button>
                 <button onClick={() => {
                   if(certForm.name) {
                     setEditForm(prev => ({...prev, certifications: [...(prev.certifications||[]), certForm]}));
                     setShowCertModal(false);
                     setCertForm({ name: '', issuer: '', year: '' });
                   } else { alert("Certification Name is required.") }
                 }} className="px-8 py-3 rounded-xl bg-[#0066FF] text-white font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-lg">Save</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
