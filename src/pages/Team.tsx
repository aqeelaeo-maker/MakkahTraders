import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { Shield, Plus, Trash2, Mail, UserPlus, AlertCircle } from 'lucide-react';

interface AuthorizedUser {
  email: string;
  addedAt: Date;
}

export default function Team() {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'authorized_users'));
      const fetchedUsers: AuthorizedUser[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedUsers.push({
          email: docSnap.id,
          addedAt: data.addedAt ? data.addedAt.toDate() : new Date(),
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
    try {
      const emailLower = newEmail.trim().toLowerCase();
      await setDoc(doc(db, 'authorized_users', emailLower), {
        email: emailLower,
        addedAt: Timestamp.now()
      });
      setNewEmail('');
      await fetchUsers(); // refresh the list
    } catch (err: any) {
      console.error('Error adding user:', err);
      setError('Failed to add user. Ensure you have admin privileges.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveUser = async (email: string) => {
    if (!window.confirm(`Are you sure you want to remove access for ${email}?`)) return;
    
    try {
      await deleteDoc(doc(db, 'authorized_users', email));
      await fetchUsers();
    } catch (err: any) {
      console.error('Error removing user:', err);
      setError('Failed to remove user.');
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
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-500" />
          Team Access Management
        </h1>
        <p className="text-slate-500 mt-1">Manage which email addresses are authorized to access the company dashboard.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-slate-400" />
            Authorize New User
          </h2>
          <form onSubmit={handleAddUser} className="flex gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter user's Google email address"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !newEmail.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add User'}
            </button>
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
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {/* Admin is always authorized */}
              <tr className="bg-indigo-50/30">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-slate-900">aqeelaeo@gmail.com</div>
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      Admin
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  System Initialized
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {/* Cannot remove admin */}
                </td>
              </tr>
              {users.map((user) => (
                <tr key={user.email}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {user.addedAt.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRemoveUser(user.email)}
                      className="text-red-600 hover:text-red-900 flex items-center justify-end gap-1 ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-500">
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
