import React, { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, orderBy, addDoc, doc, getDoc, updateDoc, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Customer, Product, Invoice, InvoiceItem, CompanyProfile } from '../types';
import { Plus, Trash2, Save, Printer, Download, ArrowLeft } from 'lucide-react';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { QRCodeCanvas } from 'qrcode.react';
import Barcode from 'react-barcode';

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = () => {
    window.print();
  };

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [company, setCompany] = useState<CompanyProfile | null>(null);

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [items, setItems] = useState<Partial<InvoiceItem>[]>([]);
  const [discount, setDiscount] = useState(0);
  const [status, setStatus] = useState<'Draft' | 'Paid' | 'Unpaid'>('Unpaid');
  const [date, setDate] = useState<number>(Date.now());
  const [customerInstCodeSearch, setCustomerInstCodeSearch] = useState('');
  const [customerInstCodeSearchInput, setCustomerInstCodeSearchInput] = useState('');
  const [productSearchInputs, setProductSearchInputs] = useState<{ [key: number]: string }>({});
  const [productSearchApplied, setProductSearchApplied] = useState<{ [key: number]: string }>({});
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    setLoading(true);
    try {
      // Fetch customers
      const cQuery = query(collection(db, 'customers'), where('userId', '==', userId));
      const cSnap = await getDocs(cQuery);
      const custData = cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
      custData.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(custData);

      // Fetch products
      const pQuery = query(collection(db, 'products'), where('userId', '==', userId));
      const pSnap = await getDocs(pQuery);
      const prodData = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      prodData.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(prodData);

      // Fetch company profile
      const compDoc = await getDoc(doc(db, 'companies', userId));
      let companyData = null;
      if (compDoc.exists()) {
        companyData = { id: compDoc.id, ...compDoc.data() } as CompanyProfile;
        setCompany(companyData);
      } else {
        // Mock default if none
        companyData = {
          name: 'TechSolutions Pakistan',
          companyCode: 'INV',
          address: '123 I.I Chundrigar Road, Karachi',
          ntn: '1234567-8',
          strn: '32778761123',
          phone: '+92 300 1234567',
          email: 'sales@techsolutions.pk',
          website: 'www.techsolutions.pk',
          bankDetails: 'Bank Al Habib, Acc: 1234-5678-9012'
        };
        setCompany(companyData);
      }

      if (id) {
        // Edit mode
        const invDoc = await getDoc(doc(db, 'invoices', id));
        if (invDoc.exists()) {
          const invData = invDoc.data() as Invoice;
          setInvoiceNumber(invData.invoiceNumber);
          setSelectedCustomerId(invData.customerId);
          setItems(invData.items || []);
          setDiscount(invData.discount || 0);
          setStatus(invData.status);
          setDate(invData.date);
        }
      } else {
        // Create mode
        const now = new Date();
        const currentYear = now.getFullYear();
        const yearStart = new Date(currentYear, 0, 1).getTime(); // January 1st

        const invQuery = query(collection(db, 'invoices'), where('userId', '==', userId));
        const invSnap = await getDocs(invQuery);
        
        let maxSeq = 0;
        invSnap.docs.forEach(d => {
          const data = d.data() as Invoice;
          if (data.date >= yearStart) {
            const parts = data.invoiceNumber.split('-');
            if (parts.length >= 3) {
              const seq = parseInt(parts[parts.length - 1], 10);
              if (!isNaN(seq) && seq > maxSeq) {
                maxSeq = seq;
              }
            }
          }
        });
        
        const nextSeq = maxSeq + 1;
        const formattedSeq = nextSeq.toString().padStart(4, '0');
        const compCode = companyData.companyCode || 'AMT';
        
        setInvoiceNumber(`${compCode}-${currentYear}-${formattedSeq}`);
        setDate(Date.now());
        setItems([]);
        addItemRow();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addItemRow = () => {
    setItems([...items, { id: Math.random().toString(), qty: 1, unitPrice: 0, taxPercentage: 18, total: 0, tax: 0, grandTotal: 0 }]);
  };

  const removeItemRow = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        productId: product.id,
        productName: product.name,
        unitPrice: product.salePrice,
        taxPercentage: product.taxPercentage || 18,
      };
      updateItemCalculations(newItems, index);
    }
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    updateItemCalculations(newItems, index);
  };

  const updateItemCalculations = (currentItems: Partial<InvoiceItem>[], index: number) => {
    const item = currentItems[index];
    const qty = item.qty || 0;
    const unitPrice = item.unitPrice || 0;
    const taxPerc = item.taxPercentage || 0;
    
    const total = qty * unitPrice;
    const tax = (total * taxPerc) / 100;
    const grandTotal = total + tax;

    currentItems[index] = { ...item, total, tax, grandTotal };
    setItems(currentItems);
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalTax = items.reduce((sum, item) => sum + (item.tax || 0), 0);
  const netTotal = subtotal + totalTax - discount;

  const handleSave = async () => {
    if (!selectedCustomerId || items.length === 0 || !items[0].productId) {
      alert("Please select customer and add at least one product.");
      return;
    }

    setLoading(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      
      const invoiceData: Omit<Invoice, 'id'> = {
        userId: auth.currentUser?.uid,
        invoiceNumber,
        date: id ? date : Date.now(),
        customerId: selectedCustomerId,
        customerName: customer?.name || '',
        customerType: customer?.customerType || 'other',
        customerNtn: customer?.ntn || '',
        customerStrn: customer?.strn || '',
        customerEmisCode: customer?.emisCode || '',
        customerInstitutionCode: customer?.institutionCode || '',
        customerHealthUnitCode: customer?.healthUnitCode || '',
        customerAddress: customer?.address,
        items: items as InvoiceItem[],
        subtotal,
        discount,
        taxAmount: totalTax,
        netTotal,
        createdBy: auth.currentUser?.uid || 'unknown',
        status,
      };

      if (id) {
        await updateDoc(doc(db, 'invoices', id), invoiceData);
      } else {
        await addDoc(collection(db, 'invoices'), invoiceData);
      }
      navigate('/invoices');
    } catch (err) {
      console.error(err);
      alert("Failed to save invoice");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!invoiceRef.current) return;
    
    try {
      const dataUrl = await toPng(invoiceRef.current, { cacheBust: true, pixelRatio: 2 });
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${invoiceNumber || 'invoice'}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF. Check console for details.');
    }
  };

  const selectedCustomerDetails = customers.find(c => c.id === selectedCustomerId);
  
  const filteredCustomers = customers.filter(c => 
    !customerInstCodeSearch || 
    String(c.institutionCode || '').toLowerCase().includes(customerInstCodeSearch.toLowerCase()) ||
    String(c.emisCode || '').toLowerCase().includes(customerInstCodeSearch.toLowerCase()) ||
    String(c.healthUnitCode || '').toLowerCase().includes(customerInstCodeSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link to="/invoices" className="text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Sales Tax Invoice</h1>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => handlePrint()}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 bg-white transition-colors flex items-center"
          >
            <Printer className="w-4 h-4 mr-2" /> Print
          </button>
          <button 
            onClick={() => generatePDF()}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 bg-white transition-colors flex items-center"
          >
            <Download className="w-4 h-4 mr-2" /> PDF
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" /> Save Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2">Document Details</h3>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Search Customer by Code</label>
              <div className="flex gap-2 mb-3">
                <input 
                  type="text" 
                  placeholder="Enter EMIS/Inst/Health Unit Code"
                  className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={customerInstCodeSearchInput}
                  onChange={(e) => setCustomerInstCodeSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = customerInstCodeSearchInput.trim();
                      setCustomerInstCodeSearch(val);
                      if (val.length > 0) {
                        const matches = customers.filter(c => 
                          String(c.institutionCode || '').toLowerCase().includes(val.toLowerCase()) ||
                          String(c.emisCode || '').toLowerCase().includes(val.toLowerCase()) ||
                          String(c.healthUnitCode || '').toLowerCase().includes(val.toLowerCase())
                        );
                        if (matches.length === 1) {
                          setSelectedCustomerId(matches[0].id);
                        } else {
                          const exactMatch = customers.find(c => 
                            String(c.institutionCode || '').toLowerCase() === val.toLowerCase() ||
                            String(c.emisCode || '').toLowerCase() === val.toLowerCase() ||
                            String(c.healthUnitCode || '').toLowerCase() === val.toLowerCase()
                          );
                          if (exactMatch) {
                            setSelectedCustomerId(exactMatch.id);
                          }
                        }
                      }
                    }
                  }}
                />
                <button 
                  type="button"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
                  onClick={() => {
                    const val = customerInstCodeSearchInput.trim();
                    setCustomerInstCodeSearch(val);
                    if (val.length > 0) {
                      const matches = customers.filter(c => 
                        String(c.institutionCode || '').toLowerCase().includes(val.toLowerCase()) ||
                        String(c.emisCode || '').toLowerCase().includes(val.toLowerCase()) ||
                        String(c.healthUnitCode || '').toLowerCase().includes(val.toLowerCase())
                      );
                      if (matches.length === 1) {
                        setSelectedCustomerId(matches[0].id);
                      } else {
                        const exactMatch = customers.find(c => 
                          String(c.institutionCode || '').toLowerCase() === val.toLowerCase() ||
                          String(c.emisCode || '').toLowerCase() === val.toLowerCase() ||
                          String(c.healthUnitCode || '').toLowerCase() === val.toLowerCase()
                        );
                        if (exactMatch) {
                          setSelectedCustomerId(exactMatch.id);
                        }
                      }
                    }
                  }}
                >
                  Search
                </button>
              </div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Customer</label>
              <select 
                className="block w-full text-sm border-slate-200 rounded-lg py-2 pl-3 border bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">Select Customer</option>
                {filteredCustomers.map(c => {
                  const code = c.emisCode || c.institutionCode || c.healthUnitCode;
                  return <option key={c.id} value={c.id}>{c.name} {code ? `(${code})` : ''}</option>;
                })}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Invoice No</label>
                <input 
                  type="text" 
                  value={invoiceNumber}
                  readOnly
                  className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-slate-100 font-mono font-medium text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                <select 
                  className="block w-full text-sm border-slate-200 rounded-lg py-2 pl-3 border bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                >
                  <option value="Unpaid">Unpaid</option>
                  <option value="Paid">Paid</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Items</h3>
              <button onClick={addItemRow} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center uppercase tracking-wider">
                <Plus className="w-3 h-3 mr-1" /> Add
              </button>
            </div>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {items.map((item, index) => (
                <div key={item.id} className="border border-slate-100 bg-slate-50/50 rounded-xl p-3 relative group">
                  <button 
                    onClick={() => removeItemRow(index)}
                    className="absolute top-3 right-3 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Search Product</label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Code/Name"
                          className="block w-full text-sm border-slate-200 rounded-lg border py-1.5 px-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={productSearchInputs[index] || ''}
                          onChange={(e) => setProductSearchInputs({ ...productSearchInputs, [index]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (productSearchInputs[index] || '').trim();
                              setProductSearchApplied({ ...productSearchApplied, [index]: val });
                              if (val.length > 0) {
                                const matches = products.filter(p => String(p.name || '').toLowerCase().includes(val.toLowerCase()) || String(p.code || '').toLowerCase().includes(val.toLowerCase()));
                                if (matches.length === 1) {
                                  handleProductSelect(index, matches[0].id);
                                } else {
                                  const exactMatch = products.find(p => String(p.code || '').toLowerCase() === val.toLowerCase() || String(p.name || '').toLowerCase() === val.toLowerCase());
                                  if (exactMatch) {
                                    handleProductSelect(index, exactMatch.id);
                                  }
                                }
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm hover:bg-slate-300 transition-colors"
                          onClick={() => {
                            const val = (productSearchInputs[index] || '').trim();
                            setProductSearchApplied({ ...productSearchApplied, [index]: val });
                            if (val.length > 0) {
                              const matches = products.filter(p => String(p.name || '').toLowerCase().includes(val.toLowerCase()) || String(p.code || '').toLowerCase().includes(val.toLowerCase()));
                              if (matches.length === 1) {
                                handleProductSelect(index, matches[0].id);
                              } else {
                                const exactMatch = products.find(p => String(p.code || '').toLowerCase() === val.toLowerCase() || String(p.name || '').toLowerCase() === val.toLowerCase());
                                if (exactMatch) {
                                  handleProductSelect(index, exactMatch.id);
                                }
                              }
                            }
                          }}
                        >
                          Search
                        </button>
                      </div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Product</label>
                      <select 
                        className="block w-full text-sm border-slate-200 rounded-lg border py-1.5 px-2 bg-white"
                        value={item.productId || ''}
                        onChange={(e) => handleProductSelect(index, e.target.value)}
                      >
                        <option value="">Select...</option>
                        {products
                          .filter(p => !productSearchApplied[index] || String(p.name || '').toLowerCase().includes(productSearchApplied[index].toLowerCase()) || String(p.code || '').toLowerCase().includes(productSearchApplied[index].toLowerCase()))
                          .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qty</label>
                        <input type="number" min="1" value={item.qty || ''} onChange={e => handleItemChange(index, 'qty', parseFloat(e.target.value))} className="block w-full text-sm border-slate-200 rounded-lg border py-1.5 px-2 bg-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price</label>
                        <input type="number" value={item.unitPrice || ''} onChange={e => handleItemChange(index, 'unitPrice', parseFloat(e.target.value))} className="block w-full text-sm border-slate-200 rounded-lg border py-1.5 px-2 bg-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tax %</label>
                        <input type="number" value={item.taxPercentage || ''} onChange={e => handleItemChange(index, 'taxPercentage', parseFloat(e.target.value))} className="block w-full text-sm border-slate-200 rounded-lg border py-1.5 px-2 bg-white" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="flex justify-between text-sm items-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Discount</span>
                <input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="w-24 text-right border-slate-200 rounded-lg border px-2 py-1 text-sm bg-slate-50 focus:outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Preview (A4 Scale approximation) */}
        <div className="lg:col-span-2 overflow-x-auto bg-gray-100 p-4 rounded-lg flex justify-center">
          <div 
            ref={invoiceRef} 
            className="print-container bg-white shadow-lg w-[210mm] min-h-[297mm] p-8 font-sans relative overflow-hidden z-0"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Background Overlay */}
            {company?.logoUrl && (
              <div className="absolute inset-0 flex items-center justify-center z-[-1] opacity-5 pointer-events-none">
                <img src={company.logoUrl} crossOrigin="anonymous" alt="Watermark" className="w-[150mm] h-[150mm] object-contain grayscale" />
              </div>
            )}
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
              <div className="flex gap-4 items-start">
                {company?.logoUrl && (
                  <img src={company.logoUrl} crossOrigin="anonymous" alt="Company Logo" className="w-12 h-12 object-contain" />
                )}
                <div>
                  <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-none">{company?.name || 'Company Name'}</h1>
                  <p className="text-[11px] text-gray-600 mt-1 max-w-xs">{company?.address}</p>
                  <div className="mt-1 text-[11px] leading-tight">
                    <span className="font-bold">NTN:</span> {company?.ntn} | <span className="font-bold">STRN:</span> {company?.strn} <br/>
                    <span className="font-bold">Phone:</span> {company?.phone}{company?.phone2 ? `, ${company.phone2}` : ''} <br/>
                    {company?.email && <><span className="font-bold">Email:</span> {company.email}</>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-gray-300 uppercase tracking-widest mb-1 leading-none">Sales Tax Invoice</h2>
                <div className="text-[11px] space-y-0.5">
                  <p><span className="font-semibold text-gray-600">Invoice No:</span> <span className="text-gray-900">{invoiceNumber}</span></p>
                  <p><span className="font-semibold text-gray-600">Date:</span> <span className="text-gray-900">{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                  <div className="mt-2 inline-block">
                    {invoiceNumber && <Barcode value={invoiceNumber} width={1} height={25} displayValue={false} margin={0} renderer="canvas" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-3">
              {selectedCustomerDetails ? (
                <div className="text-[11px] leading-tight">
                  {(() => {
                    const code = selectedCustomerDetails.emisCode || selectedCustomerDetails.institutionCode || selectedCustomerDetails.healthUnitCode;
                    return (
                      <p className="font-bold text-sm text-gray-900 mb-0.5">
                        {code ? `${code}, ` : ''}{selectedCustomerDetails.name}
                      </p>
                    );
                  })()}
                  {(!selectedCustomerDetails.customerType || selectedCustomerDetails.customerType === 'other') && selectedCustomerDetails.ntn && (
                    <p><span className="font-semibold">NTN:</span> {selectedCustomerDetails.ntn}</p>
                  )}
                  <p className="text-gray-600">Phone: {selectedCustomerDetails.phone}</p>
                </div>
              ) : (
                <p className="text-gray-400 italic text-[11px]">Select a customer...</p>
              )}
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
                {items.map((item, idx) => (
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
                    <span className="font-semibold">{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="font-medium text-gray-600">Total Sales Tax:</span>
                    <span className="font-semibold">{totalTax.toLocaleString()}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-200 text-red-600">
                      <span className="font-medium">Discount:</span>
                      <span className="font-semibold">-{discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 text-sm font-bold text-gray-900">
                    <span>Total Value Incl. Tax:</span>
                    <span>PKR {netTotal.toLocaleString()}</span>
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
      </div>
    </div>
  );
}
