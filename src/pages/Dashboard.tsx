import React, { useState, useEffect, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Invoice, Product, Customer } from '../types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Download, Calendar } from 'lucide-react';

const MONTH_NAMES = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' },
];

export default function Dashboard() {
  const { activeSubUser, companyProfile } = useOutletContext<any>() || {};
  const [stats, setStats] = useState({
    totalSales: 0,
    taxCollected: 0,
    activeCustomers: 0,
    pendingFilings: 0,
  });
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportRange, setReportRange] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

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
          const staffUsername = (activeSubUser.username || 'user2').toLowerCase();
          const u2 = companyProfile?.subUsers?.find((u: any) => u.id === 'user2' || u.role === 'staff');
          const staffProfileUsername = u2?.username?.toLowerCase();

          fetchedInvoices = fetchedInvoices.filter(inv => {
            if (!inv.createdBy) return false;
            const cb = inv.createdBy.toLowerCase();
            return (
              cb === 'user2' ||
              cb === 'staff' ||
              cb === 'staff user' ||
              cb === staffUsername ||
              (staffProfileUsername && cb === staffProfileUsername) ||
              (activeSubUser.id && cb === activeSubUser.id.toLowerCase())
            );
          });
        }

        fetchedInvoices.sort((a, b) => b.date - a.date);
        setAllInvoices(fetchedInvoices);

        // Fetch products
        const productsRef = query(collection(db, 'products'), where('userId', '==', userId));
        const productsSnapshot = await getDocs(productsRef);
        const fetchedProducts: Product[] = [];
        productsSnapshot.forEach(doc => {
          fetchedProducts.push({ id: doc.id, ...doc.data() } as Product);
        });
        setProductsList(fetchedProducts);

        // Fetch customers
        const customersRef = query(collection(db, 'customers'), where('userId', '==', userId));
        const customersSnapshot = await getDocs(customersRef);
        const fetchedCustomers: Customer[] = [];
        customersSnapshot.forEach(doc => {
          fetchedCustomers.push({ id: doc.id, ...doc.data() } as Customer);
        });
        setCustomersList(fetchedCustomers);

        setStats(prev => ({ ...prev, activeCustomers: fetchedCustomers.length }));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    productsList.forEach(p => {
      if (p.id) map.set(p.id, p);
      if (p.code) map.set(p.code.toLowerCase().trim(), p);
      if (p.name) map.set(p.name.toLowerCase().trim(), p);
    });
    return map;
  }, [productsList]);

  const customersMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customersList.forEach(c => {
      if (c.id) map.set(c.id, c);
      if (c.customerId) map.set(c.customerId, c);
      if (c.name) map.set(c.name.toLowerCase().trim(), c);
    });
    return map;
  }, [customersList]);

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
    const val = amount || 0;
    const isDecimal = val % 1 !== 0;
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: isDecimal ? 2 : 0,
      maximumFractionDigits: isDecimal ? 2 : 0,
    }).format(val);
  };

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set<number>([currentYear, currentYear - 1, currentYear + 1]);
    allInvoices.forEach(inv => {
      if (inv.date) {
        const y = new Date(inv.date).getFullYear();
        if (!isNaN(y) && y > 2000 && y < 2100) {
          years.add(y);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allInvoices]);

  const monthInvoices = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
    const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    return allInvoices.filter(invoice => 
      isWithinInterval(new Date(invoice.date), { start, end })
    );
  }, [allInvoices, selectedMonth, selectedYear]);

  const exportInvoicesToExcel = (invoices: Invoice[], fileName: string, periodTitle: string) => {
    if (invoices.length === 0) {
      alert(`No invoices found for ${periodTitle}.`);
      return;
    }

    const maxItems = Math.max(
      1,
      ...invoices.map(inv => (inv.items && inv.items.length > 0 ? inv.items.length : 1))
    );

    const excelData = invoices.map(inv => {
      const cust = customersMap.get(inv.customerId) || (inv.customerName ? customersMap.get(inv.customerName.toLowerCase().trim()) : undefined);
      const row: Record<string, any> = {
        'Invoice No': inv.invoiceNumber,
        'Date': format(new Date(inv.date), 'dd MMM yyyy'),
        'Customer Name': inv.customerName,
        'Customer NTN/CNIC': cust?.ntn || inv.customerNtn || '-',
      };

      for (let i = 0; i < maxItems; i++) {
        const item = inv.items && inv.items[i];
        const num = i + 1;
        if (item) {
          const prod = productsMap.get(item.productId) || (item.productName ? productsMap.get(item.productName.toLowerCase().trim()) : undefined);
          row[`Product ${num}`] = item.productName || prod?.name || '-';
          row[`HS Code ${num}`] = prod?.hsCode || (item as any).hsCode || '-';
          row[`Uom ${num}`] = prod?.unit || (item as any).unit || 'pcs';
          row[`Qty ${num}`] = item.qty || 0;
          row[`Rate ${num}`] = item.unitPrice || 0;
          row[`Tax Rate ${num} %`] = item.taxPercentage || 0;
          row[`Tax Amount ${num}`] = item.tax || 0;
          row[`Total ${num}`] = item.total || 0;
        } else {
          row[`Product ${num}`] = '';
          row[`HS Code ${num}`] = '';
          row[`Uom ${num}`] = '';
          row[`Qty ${num}`] = '';
          row[`Rate ${num}`] = '';
          row[`Tax Rate ${num} %`] = '';
          row[`Tax Amount ${num}`] = '';
          row[`Total ${num}`] = '';
        }
      }

      row['Amount (Excl. Tax)'] = inv.subtotal - (inv.discount || 0);
      row['Tax Amount'] = inv.taxAmount || 0;
      row['Total Amount'] = inv.netTotal || 0;
      row['Status'] = inv.status;
      row['FBR Status'] = inv.fbrStatus || 'Not Submitted';
      row['FBR Invoice No'] = inv.fbrInvoiceNo || '-';

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const colKeys = Object.keys(excelData[0] || {});
    ws['!cols'] = colKeys.map(key => {
      const maxLen = Math.max(
        key.length,
        ...excelData.map(r => String((r as any)[key] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 3, 12), 50) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
    XLSX.writeFile(wb, fileName);
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

    exportInvoicesToExcel(
      filteredInvoices,
      `${reportRange}_report_${format(new Date(), 'yyyyMMdd')}.xlsx`,
      `the selected ${reportRange} period`
    );
  };

  const handleDownloadMonthReport = () => {
    const monthName = MONTH_NAMES[selectedMonth]?.label || 'Month';
    const periodLabel = `${monthName} ${selectedYear}`;
    exportInvoicesToExcel(
      monthInvoices,
      `${monthName}_${selectedYear}_Sales_Report.xlsx`,
      periodLabel
    );
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
      {/* Top Controls & Navigation */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
        {/* Quick Range Selector */}
        <div className="flex items-center space-x-2">
          {['daily', 'weekly', 'monthly', 'yearly'].map((range) => (
            <button
              key={range}
              onClick={() => setReportRange(range as any)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all cursor-pointer ${
                reportRange === range 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {range}
            </button>
          ))}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title={`Download Excel for active ${reportRange} range`}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="capitalize">{reportRange} Excel</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link to="/products" className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 bg-white transition-colors">
            Manage Products
          </Link>
          <Link to="/invoices/new" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-colors">
            + Create Sales Tax Invoice
          </Link>
        </div>
      </div>

      {/* Monthly Report of the Year Section */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white border border-emerald-200/80 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Monthly Tax & Sales Report
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                Excel .xlsx
              </span>
            </h4>
            <p className="text-xs text-slate-600">
              Select month from the dropdown to download complete invoice ledger and tax breakdown
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Month Selector Dropdown */}
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-2 shadow-xs focus-within:ring-2 focus-within:ring-emerald-500">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-500">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              aria-label="Select Month"
              className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer pr-1"
            >
              {MONTH_NAMES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-2 shadow-xs focus-within:ring-2 focus-within:ring-emerald-500">
            <span className="text-xs font-semibold text-slate-500">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              aria-label="Select Year"
              className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer pr-1"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Download Monthly Report Button */}
          <button
            onClick={handleDownloadMonthReport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-200 transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download {MONTH_NAMES[selectedMonth].label} Report</span>
            <span className="text-xs bg-emerald-800/80 px-2 py-0.5 rounded-full font-mono">
              {monthInvoices.length}
            </span>
          </button>
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
