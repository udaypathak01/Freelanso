import { Search } from 'lucide-react'

export default function SearchBar() {
  return (
    <div className="w-full max-w-2xl mx-auto flex items-center bg-s2 border border-white-5 rounded-pill px-6 py-3 shadow-lg focus-within:border-white-9 transition-colors">
      <Search size={20} className="text-t2 mr-3" />
      <input 
        type="text" 
        placeholder="Discover amazing work..." 
        className="bg-transparent border-none outline-none w-full text-t0 placeholder:text-t2 text-base font-jakarta"
      />
    </div>
  )
}
