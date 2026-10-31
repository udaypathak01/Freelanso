import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import MobileTabBar from './components/MobileTabBar'
import ProtectedRoute from './components/ProtectedRoute'
import Footer from './components/Footer'

const Home = lazy(() => import('./pages/Home'))
const Explore = lazy(() => import('./pages/Explore'))
const BrowseJobs = lazy(() => import('./pages/BrowseJobs'))
const JobDetails = lazy(() => import('./pages/JobDetails'))
const CreateJob = lazy(() => import('./pages/CreateJob'))
const Services = lazy(() => import('./pages/Services'))
const Messages = lazy(() => import('./pages/Messages'))
const Notifications = lazy(() => import('./pages/Notifications'))
const PostWork = lazy(() => import('./pages/PostWork'))
const Profile = lazy(() => import('./pages/Profile'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Support = lazy(() => import('./pages/Support'))
const HowItWorks = lazy(() => import('./pages/HowItWorks'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const EditListing = lazy(() => import('./pages/EditListing'))
const ProjectMatchPage = lazy(() => import('./pages/ProjectMatchPage'))
const BattleDetail = lazy(() => import('./pages/BattleDetail'))
const CreateBattle = lazy(() => import('./pages/CreateBattle'))
const BattlesFeed = lazy(() => import('./components/BattlesFeed'))
const NotFound = lazy(() => import('./pages/NotFound'))

function App() {
  const location = useLocation()
  const hideNavbarOn = ['/explore', '/jobs', '/services', '/post-work', '/messages', '/notifications', '/profile', '/dashboard', '/support', '/edit', '/project', '/battles']
  const shouldHideNavbar = hideNavbarOn.some(path => location.pathname.startsWith(path))

  return (
    <div className="min-h-screen bg-bg text-t0 flex flex-col">
      {!shouldHideNavbar && <Navbar />}
      <main className="flex-1 w-full pb-20 lg:pb-0">
        <Suspense fallback={<div className="min-h-[40vh] animate-pulse bg-bg" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/jobs" element={<BrowseJobs />} />
            <Route path="/jobs/create" element={
              <ProtectedRoute>
                <CreateJob />
              </ProtectedRoute>
            } />
            <Route path="/jobs/:id/edit" element={
              <ProtectedRoute>
                <CreateJob />
              </ProtectedRoute>
            } />
            <Route path="/jobs/:id" element={<JobDetails />} />
            <Route path="/services" element={<Services />} />

            <Route path="/battles" element={<BattlesFeed />} />
            <Route path="/battles/:id" element={<BattleDetail />} />
            <Route path="/battles/create" element={
              <ProtectedRoute>
                <CreateBattle />
              </ProtectedRoute>
            } />

            <Route path="/messages" element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            } />
            <Route path="/messages/:conversationId" element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            } />

            <Route path="/post-work" element={
              <ProtectedRoute>
                <PostWork />
              </ProtectedRoute>
            } />

            <Route path="/edit/:type/:id" element={
              <ProtectedRoute>
                <EditListing />
              </ProtectedRoute>
            } />

            <Route path="/project/:id/matches" element={
              <ProtectedRoute>
                <ProjectMatchPage />
              </ProtectedRoute>
            } />

            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:uid" element={<Profile />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/support" element={<Support />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!shouldHideNavbar && <Footer />}
      <MobileTabBar />
    </div>
  )
}

export default App
