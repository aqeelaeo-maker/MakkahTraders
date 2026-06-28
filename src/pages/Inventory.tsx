import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { StockTransaction } from '../types';
import { ArrowDownRight, ArrowUpRight, Search } from 'lucide-react';
import { format } from 'date-fns';

export default function Inventory() {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app we would fetch transactions. Let's show an empty state for now.
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inventory Ledger</h1>
        <div className="flex space-x-3">
          <button className="flex items-center px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 bg-white transition-colors">
            <ArrowDownRight className="w-4 h-4 mr-2 text-green-500" />
            Stock In
          </button>
          <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Stock Out
          </button>
        </div>
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
              placeholder="Search reference..."
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-50 bg-slate-50/50">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Product ID</th>
                <th className="px-6 py-3 text-right">Qty</th>
                <th className="px-6 py-3">Reference</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center text-sm text-slate-500">Loading...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center text-sm text-slate-500">No recent transactions</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-500">
                      {format(new Date(tx.date), 'dd MMM yyyy, HH:mm')}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-[10px] leading-4 font-bold rounded uppercase tracking-wider ${
                        tx.type === 'In' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap font-mono font-medium text-slate-900">{tx.productId}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-right font-bold">
                      <span className={tx.type === 'In' ? 'text-green-600' : 'text-red-600'}>
                        {tx.type === 'In' ? '+' : '-'}{tx.qty}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-500">{tx.reference}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
