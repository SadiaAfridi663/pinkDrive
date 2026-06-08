import { useState, useEffect } from 'react';
import { sosAPI } from '../services/api';

function EmergencyContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchContacts = async () => {
    try {
      const res = await sosAPI.getContacts();
      setContacts(res.data.data.contacts);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load contacts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setError('');
    try {
      await sosAPI.addContact({ name: name.trim(), phone: phone.trim(), relationship: relationship.trim() || undefined });
      setMessage('Emergency contact added.');
      setName('');
      setPhone('');
      setRelationship('');
      setAdding(false);
      fetchContacts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add contact.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id, contactName) => {
    if (!window.confirm(`Remove ${contactName} from emergency contacts?`)) return;
    try {
      await sosAPI.removeContact(id);
      setMessage(`"${contactName}" removed.`);
      fetchContacts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove.');
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-text-light text-sm">Loading...</div>;

  return (
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Emergency Contacts</h1>
          <p className="text-[0.95rem] text-text-muted mt-1 m-0">People to notify in case of an emergency</p>
        </div>
        {!adding && contacts.length < 5 && (
          <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-4 py-2 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark" onClick={() => setAdding(true)}>
            + Add Contact
          </button>
        )}
      </div>

      {error && <p className="bg-[#fff5f5] text-error border border-[#ffcdd2] px-3.5 py-2.5 rounded-sm text-sm mb-2">{error}</p>}
      {message && <p className="bg-[#f1faf1] text-success border border-[#c8e6c9] px-3.5 py-2.5 rounded-sm text-sm mb-2">{message}</p>}

      {adding && (
        <form onSubmit={handleAdd} className="bg-white border border-border rounded-sm p-4 mb-6">
          <h3 className="font-display text-base font-semibold text-plum m-0 mb-3">New Emergency Contact</h3>
          <div className="flex flex-col gap-3 mb-3">
            <input
              className="w-full px-3 py-2 text-sm border border-border rounded-sm bg-white text-text placeholder:text-text-light focus:outline-none focus:border-pink"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="w-full px-3 py-2 text-sm border border-border rounded-sm bg-white text-text placeholder:text-text-light focus:outline-none focus:border-pink"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <input
              className="w-full px-3 py-2 text-sm border border-border rounded-sm bg-white text-text placeholder:text-text-light focus:outline-none focus:border-pink"
              placeholder="Relationship (e.g. Mother, Sister, Friend)"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className="bg-transparent border-2 border-border text-text-muted hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-4 py-2 cursor-pointer transition" onClick={() => { setAdding(false); setName(''); setPhone(''); setRelationship(''); }}>Cancel</button>
            <button type="submit" className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-4 py-2 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark disabled:opacity-50 disabled:cursor-not-allowed" disabled={saving || !name.trim() || !phone.trim()}>
              {saving ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      )}

      {contacts.length === 0 ? (
        <div className="text-center p-12 bg-white border border-border rounded">
          <div className="text-4xl mb-2">&#x1F6E1;&#xFE0F;</div>
          <h3 className="font-display text-[1.2rem] font-semibold text-plum m-0 mb-1">No emergency contacts</h3>
          <p className="text-sm text-text-muted m-0">Add emergency contacts so they are notified in case you trigger an SOS alert.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 bg-white border border-border rounded-sm">
              <div className="w-10 h-10 rounded-full bg-pink-subtle flex items-center justify-center text-sm text-pink font-semibold">
                {c.name?.[0] || '?'}
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-plum">{c.name}</span>
                <span className="text-xs text-text-muted">{c.phone}{c.relationship ? ` · ${c.relationship}` : ''}</span>
              </div>
              <button
                className="px-2.5 py-1 text-xs font-semibold border border-border rounded-sm text-text-muted bg-transparent hover:text-error hover:border-error cursor-pointer transition"
                onClick={() => handleRemove(c.id, c.name)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EmergencyContacts;
