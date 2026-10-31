import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-[#0F0F13] border-t border-white/5 pt-16 pb-8 md:pt-20 px-5 md:px-12 mt-auto">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 mb-16">

          {/* Brand & Socials - takes 2 columns on lg */}
          <div className="lg:col-span-2 pr-4">
            <Link to="/" className="inline-block mb-6">
              <span className="font-syne font-black text-2xl tracking-tighter text-white">
                <span className="text-[#0066FF]">F</span>reelans<span className="text-[#F59E0B]">o</span>
              </span>
            </Link>
            <p className="text-[#A0A0B4] text-sm md:text-[15px] leading-relaxed max-w-[320px] mb-8 font-medium">
              India's Visual Freelance Platform. Hire by seeing the work — not just reading resumes.
            </p>
            <div className="flex items-center gap-3">
              {[
                { icon: <TwitterIcon />, link: '#' },
                { icon: <InstagramIcon />, link: '#' },
                { icon: <LinkedInIcon />, link: '#' },
                { icon: <GithubIcon />, link: '#' },
              ].map((s, i) => (
                <a key={i} href={s.link} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#1E293B] hover:bg-[#0066FF] text-[#94A3B8] hover:text-white flex items-center justify-center transition-all duration-300">
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          <div className="flex flex-col">
            <h4 className="font-syne font-bold text-white text-[13px] uppercase tracking-[0.15em] mb-6">For Freelancers</h4>
            <div className="flex flex-col gap-4">
              <Link to="/post-work" className="text-[#A0A0B4] hover:text-[#0066FF] text-[14px] font-medium transition-colors">Post Your Work</Link>
              <Link to="/explore" className="text-[#A0A0B4] hover:text-[#0066FF] text-[14px] font-medium transition-colors">Browse Projects</Link>
              <Link to="/battles" className="text-[#A0A0B4] hover:text-[#0066FF] text-[14px] font-medium transition-colors">Design Battles</Link>
            </div>
          </div>

          <div className="flex flex-col">
            <h4 className="font-syne font-bold text-white text-[13px] uppercase tracking-[0.15em] mb-6">For Clients</h4>
            <div className="flex flex-col gap-4">
              <Link to="/explore" className="text-[#A0A0B4] hover:text-[#0066FF] text-[14px] font-medium transition-colors">Browse Talent</Link>
              <Link to="/services?category=design-creative" className="text-[#A0A0B4] hover:text-[#0066FF] text-[14px] font-medium transition-colors">Design &amp; Creative</Link>
              <Link to="/services?category=tech-development" className="text-[#A0A0B4] hover:text-[#0066FF] text-[14px] font-medium transition-colors">Tech &amp; Development</Link>
              <Link to="/jobs" className="text-[#A0A0B4] hover:text-[#0066FF] text-[14px] font-medium transition-colors">Browse Jobs</Link>
            </div>
          </div>

          <div className="flex flex-col">
            <h4 className="font-syne font-bold text-white text-[13px] uppercase tracking-[0.15em] mb-6">Company</h4>
            <div className="flex flex-col gap-4">
              <Link to="/how-it-works" className="text-[#A0A0B4] hover:text-[#0066FF] text-[14px] font-medium transition-colors">How It Works</Link>
              <Link to="/support" className="text-[#A0A0B4] hover:text-[#0066FF] text-[14px] font-medium transition-colors">Contact</Link>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[#64748B] text-[13px] font-medium text-center md:text-left">
            © 2026 Freelanso. All rights reserved. Made with <span className="text-red-500">❤️</span> in India.
          </p>
        </div>
      </div>
    </footer>
  )
}

function TwitterIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg>
}
function InstagramIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.20 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
}
function LinkedInIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
}
function GithubIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
}
// 
// 
// 