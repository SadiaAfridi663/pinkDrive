import { useState } from 'react';
import { reviewAPI } from '../services/api';

function ReviewModal({ isOpen, onClose, rideId, tripRequestId, reviewedId, reviewedName, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await reviewAPI.create({
        rideId,
        tripRequestId,
        reviewedId,
        rating,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
      onSubmit?.();
    } catch (err) {
      console.error('Review error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-xl">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <h3 className="text-lg font-bold text-[#1A1A1A] m-0 mb-2">Thank You!</h3>
          <p className="text-sm text-[#8B8B9E] m-0 mb-6">Your review has been submitted.</p>
          <button
            onClick={onClose}
            className="bg-[#E91E8C] text-white font-bold py-2.5 px-8 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl p-6 lg:p-8 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[#880E4F] m-0">Review {reviewedName || 'User'}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FFF8FA] text-[#8B8B9E] transition cursor-pointer border-none bg-transparent"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex justify-center gap-1 mb-5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="text-3xl transition cursor-pointer bg-transparent border-none p-1"
            >
              <svg
                className={`w-10 h-10 transition ${(hover || rating) >= star ? 'text-amber-400' : 'text-gray-200'}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="text-center text-sm text-[#8B8B9E] m-0 mb-4">
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
          </p>
        )}

        <textarea
          placeholder="Share your experience (optional)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-[#F0E0E8] text-sm resize-none focus:outline-none focus:border-[#E91E8C] focus:ring-1 focus:ring-[#E91E8C] mb-5"
        />

        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full bg-[#E91E8C] text-white font-bold py-3 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </div>
    </div>
  );
}

export default ReviewModal;
