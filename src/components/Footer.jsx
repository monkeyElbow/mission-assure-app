import React from 'react'
import { Link } from 'react-router-dom'
import { Container, Row, Col } from 'react-bootstrap';
import AgfiLogo from "../ui/AgfiLogo";
import AppLogo from '../ui/AppLogo';


export default function Footer(){
  return (
    <footer className="mt-auto bg-dark text-white py-4">

      <Container className="">
        <Row>
          <Col md={6} className='p-5'>
        <div className="flex-grow-1">
          <AppLogo />
          <div className="fw-bold mb-3 h6 fs-5 mango" >Trip insurance for the bold and faithful.</div>
          <ul className="list-unstyled m-0 fw-bold">
            <li><Link className="" to="/">Dashboard</Link></li>
            <li><Link className="" to="/newtrip">New Trip</Link></li>
            <li><Link className="" to="/claims">Claims</Link></li>
            <li><Link className="" to="/faq">FAQ</Link></li>
          </ul>
        </div>
          
          </Col>
          <Col md={6} className='p-5'>
          <div className=" fw-bold text-end mt-0 sand">Powered by:</div>
          <div className="">
{/* <a
     to="https://www.agfinancial.org"
     target="_blank"
     rel="noopener noreferrer"
     className="agfi-logo-link"
     >
</a> */}
                   <AgfiLogo className="agfi-logo" />
           
          </div>
          <div className="fs-5 fw-bold text-end mt-4 text-right">
            <a href='mailto:missionassure@agfinancial.org' >
              
            missionassure@agfinancial.org
            </a>
            </div>
          <div className="fs-3 fw-bold text-end mt-0">866-890-0156</div>
          
          </Col>
       
        </Row>

 
      </Container>
    </footer>
  )
}