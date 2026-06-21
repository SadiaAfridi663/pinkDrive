import { useParams, useNavigate } from 'react-router-dom';
import BiddingSection from '../components/BiddingSection';

function PassengerBidding() {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleAccepted = () => {
    navigate('/ride/active');
  };

  return (
    <div className="page">
      <div className="page-header page-header-accent">
        <h1>Waiting for Offers</h1>
        <p>Drivers are bidding nearby</p>
      </div>
      <BiddingSection rideId={id} onAccepted={handleAccepted} />
    </div>
  );
}

export default PassengerBidding;