import { Link, NavLink } from 'react-router-dom'
import AppLogo from '../ui/AppLogo'
// import AgfiLogo from "../ui/AgfiLogo";


export default function AppNavbar(){
  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom sticky-top">
      <div className="container" style={{minHeight:"70px"}}>
      <Link className="navbar-brand d-flex flex-column" to="/">
  <AppLogo />
  {/* <div className="d-flex align-items-center my-2">
    <p style={{fontSize:'.5rem'}} className="fw-bold mb-0 me-1">Powered by</p>
    <AgfiLogo />
  </div> */}
</Link>

        

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNav"
          aria-controls="mainNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="mainNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item"><NavLink className="nav-link" to="/">Dashboard</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/trips/new">New Trip</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/account">Account</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/faq">FAQ</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link demo-admin" to="/admin">Admin</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link demo-admin" to="/claims">Claims</NavLink></li>
          </ul>
        </div>
      </div>
    </nav>
  )
}
