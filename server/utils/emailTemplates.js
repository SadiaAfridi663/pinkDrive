const logger = require('./logger');

const BASE_STYLES = `
body{margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}
.container{max-width:560px;margin:0 auto;padding:24px 16px}
.card{background:#fff;border-radius:6px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.header{text-align:center;padding-bottom:20px;border-bottom:1px solid #eee;margin-bottom:24px}
.logo{font-size:24px;font-weight:800;color:#e91e8c;letter-spacing:-.5px;text-decoration:none}
.amount{font-size:36px;font-weight:700;color:#1a1a2e;text-align:center;margin:16px 0}
.label{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin:0 0 2px}
.value{font-size:14px;color:#1a1a2e;margin:0 0 12px;font-weight:500}
.row{display:flex;justify-content:space-between;padding:8px 0}
.row+.row{border-top:1px solid #f0f0f0}
.total-row{display:flex;justify-content:space-between;padding:12px 0;border-top:2px solid #1a1a2e;margin-top:4px;font-weight:700;font-size:16px}
.footer{text-align:center;padding-top:24px;color:#aaa;font-size:12px}
.footer a{color:#e91e8c;text-decoration:none}
.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
.badge-success{background:#e8f5e9;color:#2e7d32}
.badge-info{background:#e3f2fd;color:#1565c0}
.badge-warning{background:#fff3e0;color:#e65100}
`;

const wrapHtml = (title, bodyContent) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>${BASE_STYLES}</style></head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">PinkDrive</div>
      </div>
      ${bodyContent}
      <div class="footer">
        <p>Safe rides for women, by women.</p>
        <p style="margin-top:4px"><a href="mailto:support@pinkdrive.com">support@pinkdrive.com</a></p>
      </div>
    </div>
  </div>
</body></html>
`;

exports.rideReceipt = (ride, passenger, driver) => {
  const fare = parseFloat(ride.fare).toLocaleString();
  const date = ride.completedAt || ride.updatedAt;
  const dateStr = new Date(date).toLocaleDateString('en-PK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = new Date(date).toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit',
  });

  const bodyContent = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#1a1a2e;text-align:center">Ride Receipt</h2>
    <p style="text-align:center;color:#888;font-size:13px;margin:0 0 20px">${dateStr} · ${timeStr}</p>

    <div class="amount">PKR ${fare}</div>
    <p style="text-align:center;color:#888;font-size:13px;margin:0 0 24px">
      <span class="badge badge-success">${ride.paymentStatus === 'paid' ? 'Paid' : ride.paymentStatus}</span>
      <span style="margin-left:8px">via ${ride.paymentMethod}</span>
    </p>

    <div style="margin-bottom:20px">
      <p class="label">Receipt #</p>
      <p class="value" style="font-family:monospace">${ride.id.slice(0, 12).toUpperCase()}</p>

      <p class="label">Route</p>
      <p class="value">${ride.pickupAddress || 'Pickup'} → ${ride.dropoffAddress || 'Dropoff'}</p>

      ${driver ? `<p class="label">Driver</p><p class="value">${driver.name} (${driver.phone || 'N/A'})</p>` : ''}

      ${passenger ? `<p class="label">Passenger</p><p class="value">${passenger.name}</p>` : ''}
    </div>
  `;

  return wrapHtml('Ride Receipt - PinkDrive', bodyContent);
};

exports.paymentConfirmation = (ride, passenger, amount, method) => {
  const amt = parseFloat(amount).toLocaleString();

  const bodyContent = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#1a1a2e;text-align:center">Payment Confirmed</h2>
    <p style="text-align:center;color:#888;font-size:13px;margin:0 0 20px">Your payment has been processed successfully</p>

    <div class="amount">PKR ${amt}</div>
    <p style="text-align:center;color:#888;font-size:13px;margin:0 0 24px">
      via <strong>${method}</strong>
    </p>

    <div style="margin-bottom:16px">
      <p class="label">Ride</p>
      <p class="value">${ride.pickupAddress || 'Pickup'} → ${ride.dropoffAddress || 'Dropoff'}</p>
      <p class="label">Date</p>
      <p class="value">${new Date(ride.completedAt || ride.updatedAt).toLocaleDateString('en-PK')}</p>
    </div>
  `;

  return wrapHtml('Payment Confirmed - PinkDrive', bodyContent);
};

exports.refundNotification = (ride, passenger, amount) => {
  const amt = parseFloat(amount).toLocaleString();

  const bodyContent = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#1a1a2e;text-align:center">Refund Issued</h2>
    <p style="text-align:center;color:#888;font-size:13px;margin:0 0 20px">A refund has been processed for your ride</p>

    <div class="amount">PKR ${amt}</div>
    <p style="text-align:center;color:#888;font-size:13px;margin:0 0 24px">
      <span class="badge badge-info">Refunded</span>
    </p>

    <div style="margin-bottom:16px">
      <p class="label">Ride</p>
      <p class="value">${ride.pickupAddress || 'Pickup'} → ${ride.dropoffAddress || 'Dropoff'}</p>
      <p class="label">Amount Refunded</p>
      <p class="value">PKR ${amt}</p>
      <p class="label">Note</p>
      <p class="value">${ride.cancelledAt ? 'Ride was cancelled.' : 'Refund processed by admin.'}</p>
    </div>

    <p style="font-size:13px;color:#666;text-align:center">Refunds may take 3-5 business days to appear in your account.</p>
  `;

  return wrapHtml('Refund Issued - PinkDrive', bodyContent);
};

exports.disputeUpdate = (ride, passenger, dispute) => {
  const statusLabels = {
    resolved_approved: 'Claim Approved',
    resolved_rejected: 'Claim Rejected',
    escalated: 'Dispute Escalated',
  };
  const statusBadge = {
    resolved_approved: 'badge-success',
    resolved_rejected: 'badge-warning',
    escalated: 'badge-info',
  };

  const bodyContent = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#1a1a2e;text-align:center">Dispute Update</h2>
    <p style="text-align:center;color:#888;font-size:13px;margin:0 0 20px">Status update on your reported issue</p>

    <p style="text-align:center;margin:0 0 24px">
      <span class="badge ${statusBadge[dispute.status] || 'badge-info'}">${statusLabels[dispute.status] || dispute.status}</span>
    </p>

    <div style="margin-bottom:16px">
      <p class="label">Ride</p>
      <p class="value">${ride.pickupAddress || 'Pickup'} → ${ride.dropoffAddress || 'Dropoff'}</p>
      <p class="label">Issue</p>
      <p class="value">${dispute.disputeType.replace(/_/g, ' ')}</p>
      <p class="label">Resolution</p>
      <p class="value">${dispute.resolution || 'Under review'}</p>
      ${dispute.adminNote ? `<p class="label">Admin Note</p><p class="value">${dispute.adminNote}</p>` : ''}
    </div>
  `;

  return wrapHtml('Dispute Update - PinkDrive', bodyContent);
};

exports.driverRideCompleted = (ride, driver, passenger, fare) => {
  const amt = parseFloat(fare || ride.fare).toLocaleString();

  const bodyContent = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#1a1a2e;text-align:center">Ride Completed</h2>
    <p style="text-align:center;color:#888;font-size:13px;margin:0 0 20px">Your ride has been completed</p>

    <div class="amount">PKR ${amt}</div>
    <p style="text-align:center;color:#888;font-size:13px;margin:0 0 24px">
      <span class="badge badge-success">Earned</span>
    </p>

    <div style="margin-bottom:16px">
      <p class="label">Passenger</p>
      <p class="value">${passenger ? passenger.name : 'N/A'}</p>
      <p class="label">Route</p>
      <p class="value">${ride.pickupAddress || 'Pickup'} → ${ride.dropoffAddress || 'Dropoff'}</p>
      <p class="label">Date</p>
      <p class="value">${new Date(ride.completedAt || ride.updatedAt).toLocaleDateString('en-PK')}</p>
      <p class="label">Payment Method</p>
      <p class="value" style="text-transform:capitalize">${ride.paymentMethod}</p>
    </div>

    <p style="font-size:13px;color:#666;text-align:center">Earnings are reflected in your wallet balance.</p>
  `;

  return wrapHtml('Ride Completed - PinkDrive', bodyContent);
};
