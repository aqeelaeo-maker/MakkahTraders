import React, { useEffect, useRef, useState } from 'react';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Invoice, Customer, Product, CompanyProfile } from '../types';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import Barcode from 'react-barcode';

interface Props {
  invoiceId: string;
  action: 'print' | 'download';
  onClose: () => void;
}

export default function HiddenInvoicePrinter({ invoiceId, action, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{
    invoice: Invoice;
    customer: Customer | null;
    company: CompanyProfile;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const invDoc = await getDoc(doc(db, 'invoices', invoiceId));
        if (!invDoc.exists()) throw new Error('Invoice not found');
        const invoiceData = invDoc.data() as Invoice;

        const cSnap = await getDoc(doc(db, 'customers', invoiceData.customerId));
        const customerData = cSnap.exists() ? ({ id: cSnap.id, ...cSnap.data() } as Customer) : null;

        const userId = auth.currentUser?.uid || 'default';
        const compDoc = await getDoc(doc(db, 'companies', userId));
        let companyData: CompanyProfile;
        if (compDoc.exists()) {
          companyData = { id: compDoc.id, ...compDoc.data() } as CompanyProfile;
        } else {
          companyData = {
            name: 'TechSolutions Pakistan',
            ntn: '1234567-8',
            strn: '32778761123',
            address: '123 I.I Chundrigar Road, Karachi',
            phone: '+92 300 1234567',
            email: 'sales@techsolutions.pk',
            website: 'www.techsolutions.pk',
            bankDetails: 'Bank Al Habib, Acc: 1234-5678-9012'
          };
        }

        setData({ invoice: invoiceData, customer: customerData, company: companyData });
      } catch (err) {
        console.error('Failed to fetch invoice details', err);
        alert('Failed to load invoice for printing.');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [invoiceId]);

  useEffect(() => {
    const afterPrint = () => {
      if (action === 'print') onClose();
    };
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, [action, onClose]);

  const handlePrint = () => {
    window.print();
  };

  const generatePDF = async () => {
    if (!invoiceRef.current || !data) return;
    try {
      const dataUrl = await toPng(invoiceRef.current, { cacheBust: true, pixelRatio: 2 });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${data.invoice.invoiceNumber || 'invoice'}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF');
    } finally {
      onClose();
    }
  };

  useEffect(() => {
    if (!loading && data && invoiceRef.current && action === 'download') {
      setTimeout(() => {
        generatePDF();
      }, 500); // Wait for fonts and barcode
    }
  }, [loading, data, action]);

  if (loading || !data) return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/50 backdrop-blur-sm"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  const { invoice, customer, company } = data;

  return (
    <>
      {action === 'print' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
            <h2 className="text-xl font-bold mb-2 text-slate-900">Ready to Print</h2>
            <p className="text-sm text-slate-500 mb-6 text-center">Invoice {invoice.invoiceNumber} is ready. Click below to open the print dialog.</p>
            <div className="flex gap-3 w-full">
               <button onClick={onClose} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors">Cancel</button>
               <button onClick={() => handlePrint()} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Print Now</button>
            </div>
          </div>
        </div>
      )}
      
      <div className="screen-only-hide">
      <div 
        ref={invoiceRef} 
        className="print-container bg-white shadow-lg w-[210mm] min-h-[297mm] p-8 font-sans relative overflow-hidden z-0"
        style={{ boxSizing: 'border-box' }}
      >
        {/* Background Watermark */}
        {company?.logoUrl && (
          <div className="absolute inset-0 flex items-center justify-center z-[-1] opacity-5 pointer-events-none">
            <img src={company.logoUrl} crossOrigin="anonymous" alt="Watermark" className="w-[150mm] h-[150mm] object-contain grayscale" />
          </div>
        )}

        {/* Header */}
        <div className="border-b-2 border-gray-900 pb-2 mb-2">
          <div className="flex flex-row items-stretch justify-center relative mb-1">
            <div className="absolute left-0 top-0 bottom-0 flex justify-start py-1">
              {company?.logoUrl && (
                <img src={company.logoUrl} crossOrigin="anonymous" alt="Company Logo" className="h-full max-h-[72px] w-auto object-contain" />
              )}
            </div>
            <div className="flex flex-col items-center justify-between text-center min-h-[72px] pl-12">
              <h1 className="font-serif text-[42px] whitespace-nowrap font-black text-gray-900 uppercase tracking-tighter leading-none underline decoration-4 underline-offset-8 mb-3">
                {company?.name || 'Company Name'}
              </h1>
              <div className="text-[22px] whitespace-nowrap font-bold text-gray-800 uppercase tracking-widest leading-none">
                GENERAL ORDER SUPPLIER
              </div>
            </div>
          </div>
          <div className="flex justify-center mb-1">
            <div className="bg-black text-white px-6 py-1.5 text-[16px] font-bold uppercase tracking-widest leading-none text-center rounded-sm">
              NTN: {company?.ntn} | STRN: {company?.strn}
            </div>
          </div>
          <div className="text-[14px] text-gray-800 font-medium leading-snug text-left mt-1">
            {company?.address && <><span className="font-bold">Address:</span> {company.address} <br/></>}
            <span className="font-bold">Phone:</span> {company?.phone}{company?.phone2 ? `, ${company.phone2}` : ''} <br/>
            {company?.email && <><span className="font-bold">Email:</span> {company.email}</>}
          </div>
        </div>

        {/* Customer Info & Invoice Details */}
        <div className="flex justify-between items-start mb-3">
          <div>
            {customer ? (
              <div className="text-[16px] leading-tight">
                {(() => {
                  const code = customer.emisCode || customer.institutionCode || customer.healthUnitCode;
                  return (
                    <p className="font-bold text-gray-900 mb-0.5">
                      {code ? `${code}, ` : ''}{customer.name}
                    </p>
                  );
                })()}
                {(!customer.customerType || customer.customerType === 'other') && customer.ntn && (
                  <p><span className="font-semibold">NTN:</span> {customer.ntn}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-400 italic text-[11px]">Customer details unavailable.</p>
            )}
          </div>
          <div className="text-right text-[11px] space-y-0.5">
            <p><span className="font-semibold text-gray-600">Invoice No:</span> <span className="text-[16px] font-bold text-gray-900">{invoice.invoiceNumber}</span></p>
            <p><span className="font-semibold text-gray-600">Date:</span> <span className="text-[16px] font-bold text-gray-900">{new Date(invoice.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
            <div className="mt-2 inline-block">
              {invoice.invoiceNumber && <Barcode value={invoice.invoiceNumber} width={1} height={25} displayValue={false} margin={0} renderer="canvas" />}
            </div>
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-[11px] mb-4">
          <thead>
            <tr className="bg-gray-800 text-white text-left">
              <th className="py-1 px-2">Sr.</th>
              <th className="py-1 px-2">Description</th>
              <th className="py-1 px-2 text-center">Qty</th>
              <th className="py-1 px-2 text-right">Unit Price</th>
              <th className="py-1 px-2 text-right">Total Excl. Tax</th>
              <th className="py-1 px-2 text-center">Tax Rate</th>
              <th className="py-1 px-2 text-right">Sales Tax</th>
              <th className="py-1 px-2 text-right">Total Incl. Tax</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-1.5 px-2">{idx + 1}</td>
                <td className="py-1.5 px-2 font-medium">{item.productName || '-'}</td>
                <td className="py-1.5 px-2 text-center">{item.qty || 0}</td>
                <td className="py-1.5 px-2 text-right">{(item.unitPrice || 0).toLocaleString()}</td>
                <td className="py-1.5 px-2 text-right">{(item.total || 0).toLocaleString()}</td>
                <td className="py-1.5 px-2 text-center">{item.taxPercentage || 0}%</td>
                <td className="py-1.5 px-2 text-right">{(item.tax || 0).toLocaleString()}</td>
                <td className="py-1.5 px-2 text-right font-semibold">{(item.grandTotal || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals & Footer Info */}
        <div className="flex justify-end items-start mt-auto pt-4 border-t border-gray-200">
          <div className="w-1/2">
            <div className="bg-gray-50 p-2 rounded border border-gray-200 text-[11px]">
              <div className="flex justify-between py-1">
                <span className="font-medium text-gray-600">Total Excl. Sales Tax:</span>
                <span className="font-semibold">{invoice.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="font-medium text-gray-600">Total Sales Tax:</span>
                <span className="font-semibold">{invoice.taxAmount.toLocaleString()}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-200 text-red-600">
                  <span className="font-medium">Discount:</span>
                  <span className="font-semibold">-{invoice.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between py-2 text-sm font-bold text-gray-900">
                <span>Total Value Incl. Tax:</span>
                <span>PKR {invoice.netTotal.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-end">
              <div className="text-center">
                <div className="w-32 border-b border-gray-800 mb-1"></div>
                <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Prepared By</span>
              </div>
              <div className="text-center">
                <div className="w-32 border-b border-gray-800 mb-1"></div>
                <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Authorized Signatory</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
