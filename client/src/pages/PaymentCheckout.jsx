import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { paymentsAPI, rideAPI } from '../services/api';

function PaymentCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(searchParams.get('status') || 'processing');
  const [sessionStatus, setSessionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let retries = 0;
    const check = async () => {
      try {
        const res = await paymentsAPI.getSessionStatus(sessionId);
        if (!cancelled) {
          setSessionStatus(res.data.data);
          if (res.data.data.status === 'complete' && res.data.data.paymentStatus === 'paid') {
            setStatus('success');
            return;
          }
        }
      } catch {
        if (!cancelled && retries >= 3) setStatus('error');
      } finally {
        if (!cancelled) {
          retries++;
          if (retries < 15) {
            setTimeout(check, 2000);
          } else {
            setLoading(false);
          }
        }
      }
    };

    const timer = setTimeout(check, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId]);

  if (loading && status !== 'success') {
    return (
      <div className="page">
        <div className="page-header"><h1>Payment</h1></div>
        <div className="card p-8 text-center">
          <p className="text-stone text-sm">Verifying payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header page-header-accent"><h1>Payment</h1></div>

      <div className="card p-8 text-center">
        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">&#10004;&#65039;</div>
            <h2 className="font-display text-xl font-semibold text-navy m-0 mb-2">Payment Successful!</h2>
            <p className="text-stone text-sm mb-6">Your ride has been paid. You can track it from your dashboard.</p>
            {sessionStatus?.customerEmail && (
              <p className="text-xs text-stone mb-6">Receipt sent to {sessionStatus.customerEmail}</p>
            )}
            <button className="btn btn-primary" onClick={() => navigate('/ride/active')}>View Ride</button>
          </>
        )}

        {status === 'cancelled' && (
          <>
            <div className="text-5xl mb-4">&#x274C;</div>
            <h2 className="font-display text-xl font-semibold text-navy m-0 mb-2">Payment Cancelled</h2>
            <p className="text-stone text-sm mb-6">You cancelled the payment. Your ride is still pending — you can pay later from the ride details.</p>
            <button className="btn btn-primary" onClick={() => navigate('/ride/active')}>Go to Ride</button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">&#x26A0;&#xFE0F;</div>
            <h2 className="font-display text-xl font-semibold text-navy m-0 mb-2">Payment Error</h2>
            <p className="text-stone text-sm mb-6">Something went wrong processing your payment. Please try again.</p>
            <button className="btn btn-primary" onClick={() => navigate('/ride/active')}>Go to Ride</button>
          </>
        )}

        {status === 'processing' && !sessionId && (
          <>
            <div className="text-5xl mb-4">&#x1F504;</div>
            <h2 className="font-display text-xl font-semibold text-navy m-0 mb-2">Processing...</h2>
            <p className="text-stone text-sm mb-6">Your payment is being processed. We'll update you shortly.</p>
            <button className="btn btn-secondary" onClick={() => navigate('/passenger')}>Back to Dashboard</button>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentCheckout;
