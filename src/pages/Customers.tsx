import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, setDoc, deleteDoc, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Customer } from '../types';
import { Plus, Search, Edit2, Trash2, X, Building, GraduationCap } from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    customerType: 'other',
    emisCode: '',
    institutionCode: '',
    healthUnitCode: '',
    ntn: '',
    ntnStatus: 'Unregistered',
    strn: '',
    phone: '',
    email: '',
    address: '',
    city: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, 'customers'), where('userId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      data.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      customerType: 'other',
      emisCode: '',
      institutionCode: '',
      healthUnitCode: '',
      ntn: '',
      ntnStatus: 'Unregistered',
      strn: '',
      phone: '',
      email: '',
      address: '',
      city: ''
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const docId = editingId || `CUST-${Date.now()}`;
      
      const isGov = formData.customerType !== 'other';
      const isSchool = formData.customerType === 'school';
      
      const customerData: Customer = {
        id: docId,
        userId: auth.currentUser?.uid,
        customerId: editingId ? (formData.customerId || docId) : docId,
        name: formData.name || '',
        isSchool: isSchool, // kept for backward compatibility if used anywhere
        customerType: formData.customerType || 'other',
        emisCode: formData.customerType === 'school' ? (formData.emisCode || '') : '',
        institutionCode: formData.customerType === 'college' ? (formData.institutionCode || '') : '',
        healthUnitCode: formData.customerType === 'health_unit' ? (formData.healthUnitCode || '') : '',
        ntn: !isGov ? (formData.ntn || '') : '',
        ntnStatus: !isGov ? (formData.ntnStatus as 'Registered' | 'Unregistered' || 'Unregistered') : 'Unregistered',
        strn: !isGov ? (formData.strn || '') : '',
        phone: formData.phone || '',
        email: formData.email || '',
        address: formData.address || '',
        city: formData.city || '',
      };
      
      await setDoc(doc(db, 'customers', docId), customerData);
      
      if (editingId) {
        setCustomers(prev => prev.map(c => c.id === docId ? customerData : c));
      } else {
        setCustomers(prev => [...prev, customerData]);
      }
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Failed to save customer. Check your permissions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingId(customer.id);
    setFormData({
      ...customer,
      ntnStatus: customer.ntnStatus || (customer.ntn ? 'Registered' : 'Unregistered')
    });
    setIsModalOpen(true);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'customers', id));
      setCustomers(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Failed to delete customer.');
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.ntn?.includes(searchTerm) ||
    c.phone.includes(searchTerm) ||
    c.emisCode?.includes(searchTerm) ||
    c.institutionCode?.includes(searchTerm) ||
    c.healthUnitCode?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customers</h1>
        <button 
          onClick={handleOpenModal}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="relative rounded-md shadow-sm max-w-sm w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-200 rounded-lg py-2 border bg-white"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-50 bg-slate-50/50">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Institution Code</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center text-sm text-slate-500">Loading customers...</td></tr>
              ) : filteredCustomers.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center text-sm text-slate-500">No customers found</td></tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{customer.name}</div>
                      <div className="text-xs text-slate-500">{customer.customerId}</div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {customer.customerType === 'school' || customer.isSchool ? (
                        <>
                          <div className="font-semibold text-slate-800">EMIS Code: {customer.emisCode || 'N/A'}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><GraduationCap className="w-3 h-3" /> School</div>
                        </>
                      ) : customer.customerType === 'college' ? (
                        <>
                          <div className="font-semibold text-slate-800">Institution Code: {customer.institutionCode || 'N/A'}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Building className="w-3 h-3" /> College</div>
                        </>
                      ) : customer.customerType === 'health_unit' ? (
                        <>
                          <div className="font-semibold text-slate-800">Health Unit Code: {customer.healthUnitCode || 'N/A'}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Building className="w-3 h-3" /> Health Unit</div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold text-slate-800">NTN: {customer.ntn || 'N/A'}</div>
                          <div className="text-xs text-slate-500">STRN: {customer.strn || 'N/A'}</div>
                          <div className="text-xs font-semibold text-indigo-600 mt-0.5">
                            Status: {customer.ntnStatus || (customer.ntn ? 'Registered' : 'Unregistered')}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{customer.phone}</div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right font-medium">
                      <button 
                        onClick={() => handleEditCustomer(customer)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCustomer(customer.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-slate-900/50 backdrop-blur-sm" onClick={handleCloseModal}></div>

            <div className="relative inline-block w-full max-w-lg p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Customer' : 'Add New Customer'}</h3>
                <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-500">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer Type</label>
                  <select
                    name="customerType"
                    value={formData.customerType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="other">Regular Customer / Other</option>
                    <option value="school">Government School</option>
                    <option value="college">Government College</option>
                    <option value="health_unit">Health Unit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {formData.customerType === 'school' ? 'School Name' : 
                     formData.customerType === 'college' ? 'College Name' : 
                     formData.customerType === 'health_unit' ? 'Health Unit Name' : 'Customer Name'}
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Enter name"
                  />
                </div>

                {formData.customerType === 'school' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">EMIS Code</label>
                    <input
                      type="text"
                      name="emisCode"
                      value={formData.emisCode}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      placeholder="Enter school EMIS code"
                    />
                  </div>
                )}
                
                {formData.customerType === 'college' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Institution Code</label>
                    <input
                      type="text"
                      name="institutionCode"
                      value={formData.institutionCode}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      placeholder="Enter institution code"
                    />
                  </div>
                )}
                
                {formData.customerType === 'health_unit' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Health Unit Code</label>
                    <input
                      type="text"
                      name="healthUnitCode"
                      value={formData.healthUnitCode}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      placeholder="Enter health unit code"
                    />
                  </div>
                )}

                {formData.customerType === 'other' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">NTN Number</label>
                        <input
                          type="text"
                          name="ntn"
                          value={formData.ntn}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          placeholder="e.g., 1234567-8"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">STRN Number</label>
                        <input
                          type="text"
                          name="strn"
                          value={formData.strn}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          placeholder="e.g., 03-04-1234-567-89"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">NTN Registration Status</label>
                      <select
                        name="ntnStatus"
                        value={formData.ntnStatus || 'Unregistered'}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white font-medium"
                      >
                        <option value="Registered">Registered</option>
                        <option value="Unregistered">Unregistered</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Number</label>
                  <input
                    type="text"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    placeholder="e.g., +92 300 1234567"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Address {formData.customerType !== 'other' && <span className="text-slate-400 font-normal">(Optional)</span>}</label>
                  <textarea
                    name="address"
                    required={formData.customerType === 'other'}
                    rows={2}
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
                    placeholder="Complete physical address"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Customer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
