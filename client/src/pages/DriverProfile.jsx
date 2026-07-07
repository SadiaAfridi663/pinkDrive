import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { driverAPI } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';

function DriverProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await driverAPI.getProfile(id);
        setDriver(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load driver profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  if (loading) return (
    <div className="p-5 lg:p-8 animate-pulse space-y-4 max-w-2xl mx-auto w-full">
      <div className="h-24 bg-gray-200 rounded-full w-24 mx-auto" />
      <div className="h-8 bg-gray-200 rounded-lg w-1/2 mx-auto" />
      <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto" />
      <div className="h-32 bg-gray-200 rounded-2xl w-full" />
    </div>
  );

  if (error) return (
    <div className="p-5 lg:p-8 max-w-2xl mx-auto w-full text-center">
      <div className="bg-white rounded-2xl border border-[#F0E0E8] p-10 shadow-sm">
        <p className="text-red-500 m-0 mb-4">{error}</p>
        <button 
          className="bg-[#E91E8C] text-white font-bold text-sm py-2.5 px-6 rounded-xl hover:bg-[#C2185B] transition cursor-pointer" 
          onClick={() => navigate(-1)}
        >
          Go Back
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-5 lg:p-8 max-w-2xl mx-auto w-full">
      <div className="bg-white rounded-3xl border border-[#F0E0E8] overflow-hidden shadow-sm">
        <div className="h-32 bg-gradient-to-r from-[#FCE4EC] to-[#F8BBD0]" />
        <div className="px-6 pb-8">
          <div className="relative -mt-12 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-white">
              {driver.profilePhoto ? (
                <img src={driver.profilePhoto} alt={driver.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-amber-100 flex items-center justify-center text-3xl font-bold text-amber-600">
                  {driver.name?.[0] || 'D'}
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-[#880E4F] m-0 mt-4">{driver.name}</h1>
            <p className="text-sm text-[#8B8B9E] m-0">{driver.phone}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-[#FFF8FA] rounded-2xl p-4 text-center border border-[#F0E0E8]">
              <p className="text-[0.6rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Rating</p>
              <p className="text-2xl font-bold text-[#880E4F] m-0">⭐ {driver.rating}</p>
            </div>
            <div className="bg-[#FFF8FA] rounded-2xl p-4 text-center border border-[#F0E0E8]">
              <p className="text-[0.6rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Reviews</p>
              <p className="text-2xl font-bold text-[#880E4F] m-0">{driver.reviewCount}</p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button 
              className="bg-white border-2 border-[#F0E0E8] text-[#880E4F] font-bold text-sm py-3 px-8 rounded-xl hover:border-[#E91E8C] hover:bg-[#FCE4EC] transition cursor-pointer"
              onClick={() => navigate(-1)}
            >
              Back to Trips
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DriverProfile;
