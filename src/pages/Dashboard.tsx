import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Invoice } from '../types';
import { format } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSales: 0,
    taxCollected: 0,
    activeCustomers: 0,
    pendingFilings: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!auth.currentUser) return;
      try {
        const userId = auth.currentUser.uid;
        // Fetch invoices
        const invoicesRef = query(collection(db, 'invoices'), where('userId', '==', userId));
        const invoicesSnapshot = await getDocs(invoicesRef);
        let totalSales = 0;
        let taxCollected = 0;
        let pending = 0;
        const allInvoices: Invoice[] = [];
        
        invoicesSnapshot.forEach(doc => {
          const data = doc.data() as Invoice;
          data.id = doc.id;
          allInvoices.push(data);
          
          totalSales += data.netTotal || 0;
          taxCollected += data.taxAmount || 0;
          if (data.status === 'Draft' || data.status === 'Unpaid') {
            pending++;
          }
        });

        allInvoices.sort((a, b) => b.date - a.date);
        setRecentInvoices(allInvoices.slice(0, 4));

        // Fetch customers
        const customersRef = query(collection(db, 'customers'), where('userId', '==', userId));
        const customersSnapshot = await getDocs(customersRef);

        setStats({
          totalSales,
          taxCollected,
          activeCustomers: customersSnapshot.size,
          pendingFilings: pending,
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-end mb-6 gap-4">
        <Link to="/products" className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 bg-white">
          Manage Products
        </Link>
        <Link to="/invoices/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200">
          + Create Sales Tax Invoice
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-6 gap-6 flex-1 min-h-[600px]">
        
        {/* Stat Card 1 */}
        <div className="col-span-1 row-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-slate-400 uppercase">Total Sales</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(stats.totalSales)}</p>
        </div>

        {/* Stat Card 2 */}
        <div className="col-span-1 row-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-slate-400 uppercase">Tax Collected</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{formatCurrency(stats.taxCollected)}</p>
        </div>

        {/* Stat Card 3 */}
        <div className="col-span-1 row-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-slate-400 uppercase">Active Customers</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.activeCustomers}</p>
        </div>

        {/* Stat Card 4 */}
        <div className="col-span-1 row-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-slate-400 uppercase">Pending Invoices</p>
          <p className="text-2xl font-black text-amber-500 mt-1">{stats.pendingFilings < 10 ? `0${stats.pendingFilings}` : stats.pendingFilings}</p>
        </div>

        {/* Recent Invoices Table (Large Bento Card) */}
        <div className="col-span-1 lg:col-span-4 lg:row-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Recent Sales Tax Invoices</h3>
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">LIVE SYNC ACTIVE</span>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-50">
                  <th className="px-6 py-3">Invoice #</th>
                  <th className="px-6 py-3">Customer Name</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Amount (Excl. Tax)</th>
                  <th className="px-6 py-3 text-right">Tax Amount</th>
                  <th className="px-6 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {recentInvoices.length > 0 ? recentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-mono font-bold">{invoice.invoiceNumber}</td>
                    <td className="px-6 py-3">{invoice.customerName}</td>
                    <td className="px-6 py-3">{format(new Date(invoice.date), 'dd MMM yyyy')}</td>
                    <td className="px-6 py-3 text-slate-500 text-right">{formatCurrency(invoice.subtotal - invoice.discount)}</td>
                    <td className="px-6 py-3 text-indigo-600 font-medium text-right">{formatCurrency(invoice.taxAmount)}</td>
                    <td className="px-6 py-3 font-bold text-right">{formatCurrency(invoice.netTotal)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">
                      No invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-50 bg-slate-50/30 flex justify-center">
            <Link to="/invoices" className="text-indigo-600 text-xs font-bold uppercase tracking-widest">View Complete Ledger</Link>
          </div>
        </div>

        {/* AI Insights (Footer Bento Card) */}
        <div className="col-span-1 lg:col-span-4 lg:row-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center p-5 gap-6">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
            <div className="w-6 h-6 border-2 border-indigo-500 rounded-full border-t-transparent animate-spin" style={{ animationDuration: '3s' }}></div>
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">System Insight</h4>
            <p className="text-sm text-slate-600 mt-1">Dashboard is now displaying real-time live data from your database. You have <span className="font-bold text-slate-900">{stats.activeCustomers}</span> active customers and <span className="font-bold text-slate-900">{stats.pendingFilings}</span> pending invoices.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
