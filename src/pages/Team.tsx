import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { Shield, Plus, Trash2, Mail, UserPlus, AlertCircle, Calendar, Edit2, Check, X, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface AuthorizedUser {
  email: string;
  addedAt: Date;
  packageExpiry?: string;
}

export default function Team() {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  
  // Default expiry date: 1 year from today in YYYY-MM-DD
  const getDefaultExpiry = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [newExpiryDate, setNewExpiryDate] = useState(getDefaultExpiry());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline editing state
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'authorized_users'));
      const fetchedUsers: AuthorizedUser[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let expiryStr = '';
        if (data.packageExpiry) {
          if (typeof data.packageExpiry === 'string') {
            expiryStr = data.packageExpiry;
          } else if (data.packageExpiry?.toDate) {
            expiryStr = data.packageExpiry.toDate().toISOString().split('T')[0];
          } else if (typeof data.packageExpiry === 'number') {
            expiryStr = new Date(data.packageExpiry).toISOString().split('T')[0];
          }
        }

        fetchedUsers.push({
          email: docSnap.id,
          addedAt: data.addedAt ? data.addedAt.toDate() : new Date(),
          packageExpiry: expiryStr,
        });
      });
      setUsers(fetchedUsers);
    } catch (err: any) {
      console.error('Error fetching authorized users:', err);
      setError('Failed to load team members. You may not have permission.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const emailLower = newEmail.trim().toLowerCase();
      await setDoc(doc(db, 'authorized_users', emailLower), {
        email: emailLower,
        addedAt: Timestamp.now(),
        packageExpiry: newExpiryDate || ''
      }, { merge: true });

      setNewEmail('');
      setNewExpiryDate(getDefaultExpiry());
      setSuccess(`Authorized user ${emailLower} with Package Expiry ${newExpiryDate || 'Unlimited'}`);
      setTimeout(() => setSuccess(null), 4000);
      await fetchUsers(); // refresh the list
    } catch (err: any) {
      console.error('Error adding user:', err);
      setError('Failed to add user. Ensure you have admin privileges.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (user: AuthorizedUser) => {
    setEditingEmail(user.email);
    setEditingDate(user.packageExpiry || getDefaultExpiry());
  };

  const handleSaveEdit = async (email: string) => {
    setIsSavingEdit(true);
    setError(null);
    try {
      await setDoc(doc(db, 'authorized_users', email), {
        packageExpiry: editingDate || ''
      }, { merge: true });

      setEditingEmail(null);
      setSuccess(`Updated package expiry for ${email}`);
      setTimeout(() => setSuccess(null), 4000);
      await fetchUsers();
    } catch (err: any) {
      console.error('Error updating package expiry:', err);
      setError('Failed to update package expiry date.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRemoveUser = async (email: string) => {
    if (!window.confirm(`Are you sure you want to remove access for ${email}?`)) return;
    
    try {
      await deleteDoc(doc(db, 'authorized_users', email));
      setSuccess(`Removed access for ${email}`);
      setTimeout(() => setSuccess(null), 3000);
      await fetchUsers();
    } catch (err: any) {
      console.error('Error removing user:', err);
      setError('Failed to remove user.');
    }
  };

  const setPresetExpiry = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setNewExpiryDate(`${year}-${month}-${day}`);
  };

  const getExpiryBadge = (expiryStr?: string) => {
    if (!expiryStr) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
          No Expiry Set
        </span>
      );
    }

    const expiryDate = new Date(expiryStr + 'T23:59:59');
    const today = new Date();
    const diffMs = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let dateFormatted = expiryStr;
    try {
      dateFormatted = format(new Date(expiryStr + 'T00:00:00'), 'dd MMM yyyy');
    } catch (e) {
      // fallback
    }

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
          <Clock className="w-3 h-3 text-red-600" />
          Expired ({dateFormatted})
        </span>
      );
    } else if (diffDays <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertCircle className="w-3 h-3 text-amber-600" />
          Expiring in {diffDays} {diffDays === 1 ? 'day' : 'days'} ({dateFormatted})
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Active (Expires: {dateFormatted})
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded"></div>
              <div className="h-4 bg-slate-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-500" />
          Team Access & Package Expiry Management
        </h1>
        <p className="text-slate-500 mt-1">Super Admin control panel for aqeelaeo@gmail.com. Manage authorized emails and subscription package expiry dates.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-800">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-slate-400" />
            Authorize New User & Set Package Expiry
          </h2>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Google Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="e.g. user@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  Package Expiry Date
                </label>
                <input
                  type="date"
                  required
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Quick Preset:</span>
                <button
                  type="button"
                  onClick={() => setPresetExpiry(1)}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 transition-colors"
                >
                  +1 Month
                </button>
                <button
                  type="button"
                  onClick={() => setPresetExpiry(6)}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 transition-colors"
                >
                  +6 Months
                </button>
                <button
                  type="button"
                  onClick={() => setPresetExpiry(12)}
                  className="px-2.5 py-1 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 transition-colors"
                >
                  +1 Year
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !newEmail.trim()}
                className="inline-flex items-center px-5 py-2 border border-transparent text-sm font-bold rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors ml-auto"
              >
                {isSubmitting ? 'Authorizing...' : 'Authorize User'}
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Email Address
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Added On
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Package Expiry Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Package Status
                </th>
                <th scope="col" className="relative px-6 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {/* Super Admin Row */}
              <tr className="bg-indigo-50/40">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-bold text-slate-900">aqeelaeo@gmail.com</div>
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Super Admin
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  System Initialized
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">
                  Unlimited / Lifetime
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    <Shield className="w-3 h-3 text-indigo-600" />
                    Lifetime Access
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium text-slate-400">
                  Main Owner
                </td>
              </tr>

              {users.map((user) => {
                const isEditingThis = editingEmail === user.email;

                return (
                  <tr key={user.email} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {user.addedAt.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {isEditingThis ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editingDate}
                            onChange={(e) => setEditingDate(e.target.value)}
                            className="px-2 py-1 text-xs border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                          />
                          <button
                            onClick={() => handleSaveEdit(user.email)}
                            disabled={isSavingEdit}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                            title="Save Expiry Date"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingEmail(null)}
                            className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">
                            {user.packageExpiry
                              ? format(new Date(user.packageExpiry + 'T00:00:00'), 'dd MMM yyyy')
                              : 'No Expiry Set'}
                          </span>
                          <button
                            onClick={() => handleStartEdit(user)}
                            className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100 transition-colors"
                            title="Edit Package Expiry Date"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getExpiryBadge(user.packageExpiry)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        {!isEditingThis && (
                          <button
                            onClick={() => handleStartEdit(user)}
                            className="text-indigo-600 hover:text-indigo-900 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Edit Expiry
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveUser(user.email)}
                          className="text-red-600 hover:text-red-900 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    No additional users have been authorized yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
