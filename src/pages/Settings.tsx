import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { CompanyProfile } from '../types';
import { Save, Building2, Upload } from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [profile, setProfile] = useState<CompanyProfile>({
    name: '',
    companyCode: '',
    ntn: '',
    strn: '',
    address: '',
    phone: '',
    phone2: '',
    email: '',
    website: '',
    bankDetails: '',
    logoUrl: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'companies', auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as CompanyProfile;
        setProfile(data);
        if (data.logoUrl) setLogoPreview(data.logoUrl);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setLogoPreview(dataUrl);
          setProfile(prev => ({ ...prev, logoUrl: dataUrl }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const profileToSave = {
        ...Object.fromEntries(
          Object.entries(profile).filter(([_, v]) => v !== undefined)
        ),
        userId: auth.currentUser.uid
      };
      await setDoc(doc(db, 'companies', auth.currentUser.uid), profileToSave);
      alert('Company profile updated successfully.');
    } catch (error) {
      console.error(error);
      alert('Failed to update company profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-0">
      <div className="flex justify-between items-center mt-4 sm:mt-0">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Settings</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900 flex items-center uppercase tracking-widest">
            <Building2 className="w-4 h-4 mr-2 text-indigo-500" />
            Company Profile
          </h3>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            This information will be displayed on the sales tax invoices.
          </p>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col items-start gap-4">
              <label className="block text-xs font-bold text-slate-600">Company Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <Upload className="w-4 h-4 mr-2 text-slate-500" />
                    <span>Choose Logo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                  <p className="text-xs text-slate-500">PNG, JPG up to 2MB. Recommendation: 400x400px.</p>
                </div>
              </div>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-600 mb-1">Company Name</label>
              <input type="text" required value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-600 mb-1">Company Code (for Invoices)</label>
              <input type="text" required value={profile.companyCode || ''} onChange={e => setProfile({...profile, companyCode: e.target.value.toUpperCase()})} placeholder="e.g., TAX" className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">NTN Number</label>
              <input type="text" required value={profile.ntn} onChange={e => setProfile({...profile, ntn: e.target.value})} className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">STRN Number</label>
              <input type="text" required value={profile.strn} onChange={e => setProfile({...profile, strn: e.target.value})} className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Address</label>
              <textarea rows={2} required value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Phone 1</label>
              <input type="text" required value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Phone 2 (Optional)</label>
              <input type="text" value={profile.phone2 || ''} onChange={e => setProfile({...profile, phone2: e.target.value})} className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
              <input type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Website</label>
              <input type="text" value={profile.website} onChange={e => setProfile({...profile, website: e.target.value})} className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Bank Details</label>
              <textarea rows={2} required value={profile.bankDetails} onChange={e => setProfile({...profile, bankDetails: e.target.value})} placeholder="Bank Name, Account Title, IBAN" className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>

          <div className="pt-5 border-t border-slate-100">
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
