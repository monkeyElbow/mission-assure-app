import { Link } from 'react-router-dom'
export default function NotFound(){
  return (
    <div className="container my-3 text-center">
      <h1 className="h3 mb-2">Page not found</h1>
      <p className="text-muted">Try the dashboard.</p>
      <Link to="/" className="btn btn-primary mt-2">Go Home</Link>
    </div>
  )
}
