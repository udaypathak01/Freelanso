import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { gsap } from 'gsap'
import Sidebar from '../components/Sidebar'
import { fetchServices, fetchServiceCategories } from '../lib/serviceData'

export default function Services() {
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [categories, setCategories] = useState([])
  const [categoriesError, setCategoriesError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [priceSort, setPriceSort] = useState(null)
  const [allServices, setAllServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)
  const [searchParams] = useSearchParams()
  const containerRef = useRef(null)

  // Load canonical categories from the shared API source.
  useEffect(() => {
    const controller = new AbortController()
    setCategoriesError('')
    fetchServiceCategories({ signal: controller.signal })
      .then((items) => {
        setCategories(items)
        const requestedCategory = searchParams.get('category')
        if (items.some((category) => category.slug === requestedCategory)) {
          setSelectedCategory(requestedCategory)
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setCategoriesError(error.message || 'Unable to load categories.')
        }
      })
    return () => controller.abort()
  }, [retryNonce, searchParams])

  // Search, category, and price ordering are applied by the API.
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setLoadError('')
      try {
        const data = await fetchServices({
          q: search.trim(),
          category: selectedCategory,
          sort: priceSort === 'low-to-high'
            ? 'price_asc'
            : priceSort === 'high-to-low'
              ? 'price_desc'
              : 'newest',
          signal: controller.signal,
        })
        if (active) setAllServices(data)
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setAllServices([])
          setLoadError(error.message || 'Unable to load services.')
        }
      } finally {
        if (active && !controller.signal.aborted) setLoading(false)
      }
    }, 200)
    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, selectedCategory, priceSort, retryNonce])

  const filteredServices = allServices

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.services-hero', { y: -20, opacity: 0, duration: 0.8, ease: 'power4.out' })
      gsap.from('.service-card', {
        scale: 0.95,
        opacity: 0,
        y: 30,
        duration: 0.6,
        stagger: 0.05,
        delay: 0.2,
        ease: 'power3.out'
      })
    }, containerRef)
    return () => ctx.revert()
  }, [filteredServices.length])

  return (
    <div className="flex min-h-screen bg-[#09090B] text-white overflow-hidden" ref={containerRef}>
      <div className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? 'w-[78px]' : 'w-[240px]'}`}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      <main className="flex-1 min-w-0 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto">
          {/* Header Area */}
          <div className="services-hero flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
            <div>
              <p className="text-[#666] text-sm font-bold uppercase tracking-widest mb-1">{loading ? '...' : filteredServices.length} services available</p>
              <h1 className="text-[2.5rem] font-black uppercase tracking-tight leading-tight">Explore Services</h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 bg-[#0066FF] text-white px-6 py-3 rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,102,255,0.2)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg>
                Create Service
              </button>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex items-center gap-4 mb-10">
            <div className="flex-1 relative">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[#555]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              </div>
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services..." 
                className="w-full bg-[#121216] border border-white/5 rounded-2xl py-4 pl-14 pr-14 text-white text-[1rem] placeholder-[#444] outline-none focus:border-[#0066FF]/30 transition-all"
              />
            </div>
            <button 
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-2 bg-[#121216] border border-white/5 px-6 py-4 rounded-2xl font-black text-xs hover:bg-[#15151A] hover:border-[#0066FF]/30 transition-all text-[#888] hover:text-[#0066FF]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 14V3M1 14h6M9 8h6M17 16h6" /></svg>
              Filters
            </button>
          </div>

          {/* Grid */}
          {categoriesError ? (
            <div className="mb-6 text-center" role="alert">
              <p className="text-red-400 font-bold">{categoriesError}</p>
              <button
                onClick={() => setRetryNonce((value) => value + 1)}
                className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold"
              >
                Retry
              </button>
            </div>
          ) : loadError ? (
            <div className="py-16 text-center" role="alert">
              <p className="text-red-400 font-bold">{loadError}</p>
              <button
                onClick={() => setRetryNonce((value) => value + 1)}
                className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold"
              >
                Retry
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {loading ? (
               [1,2,3,4,5,6].map(i => <div key={i} className="aspect-[16/20] bg-white/5 rounded-[28px] animate-pulse" />)
            ) : filteredServices.length > 0 ? (
              filteredServices.map((service) => (
                <div key={service.id} className="service-card group">
                  <ServiceCard service={service} />
                </div>
              ))
            ) : (
              <div className="col-span-full py-20 flex flex-col items-center justify-center bg-[#121216] border border-dashed border-white/10 rounded-[32px] stagger-item">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-[#444] mb-6">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21 21-4.3-4.3" /><circle cx="11" cy="11" r="8" /></svg>
                </div>
                <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">No services found</h3>
                <p className="text-[#666] text-sm font-medium mb-8">Try adjusting your search or filters to find what you're looking for.</p>
                <button 
                  onClick={() => { setSearch(''); setSelectedCategory(''); setPriceSort(null); }}
                  className="px-6 py-2.5 rounded-xl border border-white/10 text-xs font-black uppercase hover:bg-white/5 transition-all"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      </main>

      {/* Filter Modal */}
      {showFilters && (
        <FilterModal 
          onClose={() => setShowFilters(false)} 
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          priceSort={priceSort}
          setPriceSort={setPriceSort}
          categories={categories}
          serviceCount={allServices.length}
        />
      )}
    </div>
  )
}

function ServiceCard({ service }) {
  return (
    <div className="bg-[#121216] border border-white/5 rounded-[28px] overflow-hidden hover:border-[#0066FF]/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500 cursor-pointer">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img src={service.image} alt={service.title} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-[#0066FF]">
          {service.categoryLabel}
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-[1.1rem] font-bold leading-tight mb-6 line-clamp-2 h-[44px] group-hover:text-[#0066FF] transition-colors">{service.title}</h3>
        
        <div className="flex items-center justify-between border-t border-white/[0.03] pt-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={service.author.avatar} alt={service.author.name} className="w-8 h-8 rounded-full border border-white/5" />
              {service.author.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-[#121216] rounded-full" />}
            </div>
            <span className="text-xs font-bold text-[#666] group-hover:text-white transition-colors">{service.author.name}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[1.2rem] font-black">{service.priceLabel}</span>
            <button className="text-[10px] font-black uppercase text-[#444] hover:text-[#0066FF] transition-colors mt-1">Manage</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterModal({ onClose, selectedCategory, setSelectedCategory, priceSort, setPriceSort, categories, serviceCount }) {
  const modalRef = useRef(null)
  const currentCategory = categories.find(c => c.slug === selectedCategory)

  useEffect(() => {
    gsap.fromTo(modalRef.current, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' })
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div ref={modalRef} className="bg-[#121216] border border-white/5 w-full max-w-[800px] h-[600px] rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#0066FF]/10 flex items-center justify-center text-[#0066FF]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-black">Filter Services</h2>
              <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">{serviceCount} services available</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-[#555] hover:text-white transition-all">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Categories Sidebar */}
          <div className="w-[240px] border-r border-white/5 bg-black/[0.05] flex flex-col p-4 overflow-y-auto">
            <button 
              onClick={() => setSelectedCategory('')}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider mb-2 transition-all ${!selectedCategory ? 'bg-[#0066FF] text-white' : 'text-[#444] hover:bg-white/5 hover:text-white'}`}
            >
              All Categories
            </button>
            {categories.map(cat => (
              <button 
                key={cat.slug}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider mb-2 transition-all ${selectedCategory === cat.slug ? 'bg-[#0066FF]/10 text-[#0066FF]' : 'text-[#444] hover:bg-white/5 hover:text-white'}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Filters Main Area */}
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="mb-10">
              <h4 className="text-[10px] font-black text-[#444] uppercase tracking-[0.2em] mb-4">Sort By Price</h4>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPriceSort('low-to-high')}
                  className={`px-5 py-2.5 rounded-full border text-[0.75rem] font-bold transition-all ${priceSort === 'low-to-high' ? 'bg-[#0066FF] border-[#0066FF] text-white' : 'border-white/5 text-[#555] hover:border-white/20'}`}
                >
                  Price: Low to High
                </button>
                <button 
                  onClick={() => setPriceSort('high-to-low')}
                  className={`px-5 py-2.5 rounded-full border text-[0.75rem] font-bold transition-all ${priceSort === 'high-to-low' ? 'bg-[#0066FF] border-[#0066FF] text-white' : 'border-white/5 text-[#555] hover:border-white/20'}`}
                >
                  Price: High to Low
                </button>
              </div>
            </div>

            {currentCategory && <h4 className="text-[10px] font-black text-[#444] uppercase tracking-[0.2em]">{currentCategory.label}</h4>}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-6 border-t border-white/5 flex items-center justify-between shrink-0">
          <button 
            onClick={() => { setSelectedCategory(''); setPriceSort(null); }}
            className="text-xs font-black uppercase text-[#444] hover:text-white transition-colors"
          >
            Reset
          </button>
          <button 
            onClick={onClose}
            className="bg-[#0066FF] text-white px-8 py-3 rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,102,255,0.2)]"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )
}
