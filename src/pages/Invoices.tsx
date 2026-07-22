import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, deleteDoc, doc, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Invoice } from '../types';
import { Plus, Search, FileText, Download, Eye, Edit2, Trash2, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Link, useOutletContext } from 'react-router';
import HiddenInvoicePrinter from '../components/HiddenInvoicePrinter';

export default function Invoices() {
  const { activeSubUser, companyProfile } = useOutletContext<any>() || {};
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activePrintId, setActivePrintId] = useState<string | null>(null);
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [activeSubUser]);

  const fetchInvoices = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'invoices'), 
        where('userId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
      if (activeSubUser?.role === 'staff') {
        const staffUsername = activeSubUser.username || 'user2';
        data = data.filter(inv => 
          inv.createdBy === staffUsername || 
          inv.createdBy === 'user2' || 
          inv.createdBy === activeSubUser.id
        );
      }
      data.sort((a, b) => (b.invoiceNumber || '').localeCompare(a.invoiceNumber || '', undefined, { numeric: true }));
      setInvoices(data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCreatedByDisplay = (inv: Invoice) => {
    const u1 = companyProfile?.subUsers?.find((u: any) => u.id === 'user1' || u.role === 'owner');
    const u2 = companyProfile?.subUsers?.find((u: any) => u.id === 'user2' || u.role === 'staff');

    const u1Name = u1?.username || 'user1';
    const u2Name = u2?.username || 'user2';

    if (
      inv.createdBy === 'user2' || 
      inv.createdBy === 'staff' || 
      (u2?.username && inv.createdBy === u2.username)
    ) {
      return u2Name;
    }
    
    if (
      inv.createdBy === 'user1' || 
      inv.createdBy === 'owner' || 
      inv.createdBy === 'Owner' || 
      (u1?.username && inv.createdBy === u1.username)
    ) {
      return u1Name;
    }

    if (inv.createdBy === auth.currentUser?.uid || !inv.createdBy || inv.createdBy === 'unknown') {
      return u1Name;
    }

    return inv.createdBy;
  };

  const confirmDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'invoices', id));
      setInvoices(invoices.filter(inv => inv.id !== id));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice');
      setDeleteConfirmId(null);
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sales Invoices</h1>
        <Link 
          to="/invoices/new"
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Sales Tax Invoice
        </Link>
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
              placeholder="Search invoice number or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-50 bg-slate-50/50">
                <th className="px-6 py-3">Invoice</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Created By</th>
                <th className="px-6 py-3 text-right">Amount (PKR)</th>
                <th className="px-6 py-3">FBR Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center text-sm text-slate-500">Loading invoices...</td></tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center text-sm text-slate-500">No invoices found</td></tr>
              ) : (
                paginatedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-indigo-400 mr-3" />
                        <div>
                          <div className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</div>
                          <div className="text-xs text-slate-500">{format(new Date(invoice.date), 'dd MMM, yyyy')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{invoice.customerName}</div>
                      <div className="text-xs text-slate-500">
                        {invoice.customerType === 'school' || (!invoice.customerType && invoice.customerEmisCode) ? (
                          <>EMIS Code: {invoice.customerEmisCode || 'N/A'}</>
                        ) : invoice.customerType === 'college' || (!invoice.customerType && invoice.customerInstitutionCode) ? (
                          <>Institution Code: {invoice.customerInstitutionCode || 'N/A'}</>
                        ) : invoice.customerType === 'health_unit' || (!invoice.customerType && invoice.customerHealthUnitCode) ? (
                          <>Health Unit Code: {invoice.customerHealthUnitCode || 'N/A'}</>
                        ) : (
                          <>
                            {invoice.customerNtn ? `NTN: ${invoice.customerNtn}` : 'NTN: N/A'}
                            {invoice.customerStrn && <><br/>STRN: {invoice.customerStrn}</>}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="text-sm text-slate-600 font-medium capitalize">{getCreatedByDisplay(invoice)}</div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right">
                      <div className="font-bold text-slate-900">{invoice.netTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                      <div className="text-xs text-indigo-600 font-medium">Tax: {invoice.taxAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {invoice.fbrStatus === 'Submitted' ? (
                        <span className="px-2 py-1 inline-flex text-[10px] leading-4 font-bold rounded uppercase tracking-wider bg-emerald-100 text-emerald-700">
                          {invoice.fbrInvoiceNo || 'Submitted'}
                        </span>
                      ) : invoice.fbrStatus === 'Failed' ? (
                        <span className="px-2 py-1 inline-flex text-[10px] leading-4 font-bold rounded uppercase tracking-wider bg-red-100 text-red-700">
                          Failed
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium flex items-center justify-end gap-3">
                      <Link to={`/invoices/edit/${invoice.id}`} className="text-indigo-600 hover:text-indigo-900 transition-colors" title="View / Edit">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button onClick={(e) => { e.preventDefault(); invoice.id && setActivePrintId(invoice.id); }} className="text-slate-400 hover:text-slate-700 transition-colors" title="Print Invoice">
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.preventDefault(); invoice.id && setActiveDownloadId(invoice.id); }} className="text-slate-400 hover:text-slate-700 transition-colors" title="Download PDF">
                        <Download className="w-4 h-4" />
                      </button>
                      <button onClick={() => invoice.id && setDeleteConfirmId(invoice.id)} className="text-red-400 hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredInvoices.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <span className="font-medium">Items per page:</span>
              <select 
                value={itemsPerPage} 
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="border-slate-200 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-1.5 pl-3 pr-8 bg-white border outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={filteredInvoices.length}>All</option>
              </select>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-sm text-slate-600 font-medium">
                Page {currentPage} of {totalPages || 1}
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm text-sm"
                >
                  Previous
                </button>
                <button 
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Invoice?</h3>
            <p className="text-slate-600 text-sm mb-6">Are you sure you want to delete this invoice? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => confirmDelete(deleteConfirmId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm shadow-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {activePrintId && (
        <HiddenInvoicePrinter 
          invoiceId={activePrintId} 
          action="print" 
          onClose={() => setActivePrintId(null)} 
        />
      )}

      {activeDownloadId && (
        <HiddenInvoicePrinter 
          invoiceId={activeDownloadId} 
          action="download" 
          onClose={() => setActiveDownloadId(null)} 
        />
      )}
    </div>
  );
}
