import React, { useState, useEffect, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Invoice } from '../types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  const { activeSubUser } = useOutletContext<any>() || {};
  const [stats, setStats] = useState({
    totalSales: 0,
    taxCollected: 0,
    activeCustomers: 0,
    pendingFilings: 0,
  });
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportRange, setReportRange] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!auth.currentUser) return;
      try {
        const userId = auth.currentUser.uid;
        // Fetch invoices
        const invoicesRef = query(collection(db, 'invoices'), where('userId', '==', userId));
        const invoicesSnapshot = await getDocs(invoicesRef);
        let fetchedInvoices: Invoice[] = [];
        
        invoicesSnapshot.forEach(doc => {
          const data = doc.data() as Invoice;
          data.id = doc.id;
          fetchedInvoices.push(data);
        });

        if (activeSubUser?.role === 'staff') {
          fetchedInvoices = fetchedInvoices.filter(inv => inv.createdBy === activeSubUser.username);
        }

        fetchedInvoices.sort((a, b) => b.date - a.date);
        setAllInvoices(fetchedInvoices);

        // Fetch customers
        const customersRef = query(collection(db, 'customers'), where('userId', '==', userId));
        const customersSnapshot = await getDocs(customersRef);

        setStats(prev => ({ ...prev, activeCustomers: customersSnapshot.size }));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (reportRange) {
      case 'daily':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'weekly':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'monthly':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'yearly':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
    }

    const filteredInvoices = allInvoices.filter(invoice => 
      isWithinInterval(new Date(invoice.date), { start, end })
    );

    let totalSales = 0;
    let taxCollected = 0;
    let pending = 0;

    filteredInvoices.forEach(data => {
      totalSales += data.netTotal || 0;
      taxCollected += data.taxAmount || 0;
      if (data.status === 'Draft' || data.status === 'Unpaid') {
        pending++;
      }
    });

    setStats(prev => ({
      ...prev,
      totalSales,
      taxCollected,
      pendingFilings: pending,
    }));

    setRecentInvoices(filteredInvoices.slice(0, 4));
  }, [allInvoices, reportRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const handleExportExcel = () => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (reportRange) {
      case 'daily':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'weekly':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'monthly':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'yearly':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
    }

    const filteredInvoices = allInvoices.filter(invoice => 
      isWithinInterval(new Date(invoice.date), { start, end })
    );

    const data = filteredInvoices.map(inv => ({
      'Invoice No': inv.invoiceNumber,
      'Date': format(new Date(inv.date), 'dd MMM yyyy'),
      'Customer Name': inv.customerName,
      'Amount (Excl. Tax)': inv.subtotal - inv.discount,
      'Tax Amount': inv.taxAmount,
      'Total Amount': inv.netTotal,
      'Status': inv.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${reportRange}_report_${format(new Date(), 'yyyyMMdd')}.xlsx`);
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
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-2">
          {['daily', 'weekly', 'monthly', 'yearly'].map((range) => (
            <button
              key={range}
              onClick={() => setReportRange(range as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                reportRange === range 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="flex gap-4">
          <button onClick={handleExportExcel} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors">
            Download Excel
          </button>
          <Link to="/products" className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 bg-white transition-colors">
            Manage Products
          </Link>
          <Link to="/invoices/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">
            + Create Sales Tax Invoice
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-6 gap-6 flex-1 min-h-[600px]">
        
        {/* Stat Card 1 */}
        <div className="col-span-1 row-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-slate-400 uppercase">Total Sales ({reportRange})</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(stats.totalSales)}</p>
        </div>

        {/* Stat Card 2 */}
        <div className="col-span-1 row-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-slate-400 uppercase">Tax Collected ({reportRange})</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{formatCurrency(stats.taxCollected)}</p>
        </div>

        {/* Stat Card 3 */}
        <div className="col-span-1 row-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-slate-400 uppercase">Active Customers (All Time)</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.activeCustomers}</p>
        </div>

        {/* Stat Card 4 */}
        <div className="col-span-1 row-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-slate-400 uppercase">Pending Invoices ({reportRange})</p>
          <p className="text-2xl font-black text-amber-500 mt-1">{stats.pendingFilings < 10 ? `0${stats.pendingFilings}` : stats.pendingFilings}</p>
        </div>

        {/* Recent Invoices Table (Large Bento Card) */}
        <div className="col-span-1 lg:col-span-4 lg:row-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Recent Invoices ({reportRange})</h3>
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
                      No invoices found for this period.
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
            <p className="text-sm text-slate-600 mt-1">Dashboard is displaying data for the <span className="font-bold text-slate-900 capitalize">{reportRange}</span> period. You have <span className="font-bold text-slate-900">{stats.activeCustomers}</span> active customers total and <span className="font-bold text-slate-900">{stats.pendingFilings}</span> pending invoices in this period.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
