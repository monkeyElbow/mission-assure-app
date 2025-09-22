import { Routes, Route, Outlet } from 'react-router-dom'
import AppNavbar from './components/AppNavbar.jsx'

import Dashboard from './pages/Dashboard.jsx'
import TripNew from './pages/TripNew.jsx'
import TripDetail from './pages/TripDetail.jsx'
import Claims from './pages/Claims.jsx'
import Admin from './pages/Admin.jsx'
import NotFound from './pages/NotFound.jsx'
import FAQ from './pages/FAQ.jsx'
import Footer from './components/Footer.jsx'

function Layout(){
  return (
    <>
      <AppNavbar />
      <main className="py-4">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

export default function App(){
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="trips/new" element={<TripNew />} />
        <Route path="trips/:id" element={<TripDetail />} />
        <Route path="claims" element={<Claims />} />
        <Route path="faq" element={<FAQ />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
