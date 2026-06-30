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
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const [currentItem, setCurrentItem] = useState<Partial<InvoiceItem>>({ qty: 1, unitPrice: 0, taxPercentage: 18, total: 0, tax: 0, grandTotal: 0 });
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (selectedCustomerId && !isCustomerDropdownOpen) {
      const c = customers.find(x => x.id === selectedCustomerId);
      if (c) {
        const code = c.emisCode || c.institutionCode || c.healthUnitCode;
        setCustomerSearchTerm(`${c.name} ${code ? `(${code})` : ''}`);
      }
    }
  }, [selectedCustomerId, customers, isCustomerDropdownOpen]);

  useEffect(() => {
    if (currentItem.productId && !isProductDropdownOpen) {
      const p = products.find(x => x.id === currentItem.productId);
      if (p) {
        const expectedTerm = `${p.name} ${p.code ? `(${p.code})` : ''}`;
        if (productSearchTerm !== expectedTerm) {
          setProductSearchTerm(expectedTerm);
        }
      }
    }
  }, [currentItem.productId, products, isProductDropdownOpen, productSearchTerm]);

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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addItemRow = () => {
    if (!currentItem.productId) {
      alert("Please select a product");
      return;
    }
    setItems([...items, { ...currentItem, id: Math.random().toString() }]);
    setCurrentItem({ qty: 1, unitPrice: 0, taxPercentage: 18, total: 0, tax: 0, grandTotal: 0 });
    setProductSearchTerm('');
    setIsProductDropdownOpen(false);
  };

  const removeItemRow = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItem = {
        ...currentItem,
        productId: product.id,
        productName: product.name,
        unitPrice: product.salePrice,
        taxPercentage: product.taxPercentage || 18,
      };
      updateCurrentItemCalculations(newItem);
    } else {
      setCurrentItem({ ...currentItem, productId: '', productName: '' });
    }
  };

  const handleCurrentItemChange = (field: keyof InvoiceItem, value: number) => {
    const newItem = { ...currentItem, [field]: value };
    updateCurrentItemCalculations(newItem);
  };

  const updateCurrentItemCalculations = (item: Partial<InvoiceItem>) => {
    const qty = item.qty || 0;
    const unitPrice = item.unitPrice || 0;
    const taxPerc = item.taxPercentage || 0;
    
    const total = qty * unitPrice;
    const tax = (total * taxPerc) / 100;
    const grandTotal = total + tax;

    setCurrentItem({ ...item, total, tax, grandTotal });
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
            <div className="relative" ref={customerDropdownRef}>
              <label className="block text-xs font-bold text-slate-600 mb-1">Customer</label>
              <input
                type="text"
                placeholder="Search by name, EMIS/Inst/Health Unit Code..."
                className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={customerSearchTerm}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value);
                  setIsCustomerDropdownOpen(true);
                  if (e.target.value === '') {
                    setSelectedCustomerId('');
                  }
                }}
                onFocus={() => setIsCustomerDropdownOpen(true)}
              />
              {isCustomerDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {customers
                    .filter(c => {
                      const search = customerSearchTerm.toLowerCase();
                      return (
                        c.name.toLowerCase().includes(search) ||
                        String(c.institutionCode || '').toLowerCase().includes(search) ||
                        String(c.emisCode || '').toLowerCase().includes(search) ||
                        String(c.healthUnitCode || '').toLowerCase().includes(search)
                      );
                    })
                    .map(c => {
                      const code = c.emisCode || c.institutionCode || c.healthUnitCode;
                      return (
                        <div
                          key={c.id}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setCustomerSearchTerm(`${c.name} ${code ? `(${code})` : ''}`);
                            setIsCustomerDropdownOpen(false);
                          }}
                        >
                          <div className="font-medium text-slate-800">{c.name}</div>
                          {code && <div className="text-xs text-slate-500">Code: {code}</div>}
                        </div>
                      );
                    })}
                  {customers.filter(c => {
                      const search = customerSearchTerm.toLowerCase();
                      return (
                        c.name.toLowerCase().includes(search) ||
                        String(c.institutionCode || '').toLowerCase().includes(search) ||
                        String(c.emisCode || '').toLowerCase().includes(search) ||
                        String(c.healthUnitCode || '').toLowerCase().includes(search)
                      );
                    }).length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">No customers found</div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Invoice No</label>
              <input 
                type="text" 
                value={invoiceNumber}
                readOnly
                className="block w-full text-sm border-slate-200 rounded-lg py-2 px-3 border bg-slate-100 font-mono font-medium text-slate-600"
              />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Items</h3>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {items.map((item, index) => (
                <div key={item.id} className="flex justify-between items-center border border-slate-100 bg-slate-50/50 rounded-lg p-2 group">
                  <div className="text-sm">
                    <span className="font-semibold text-slate-700">{item.productName}</span>
                    <span className="text-slate-500 text-xs ml-2">({item.qty} x Rs {item.unitPrice})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-800">Rs {item.total?.toFixed(2)}</span>
                    <button 
                      onClick={() => removeItemRow(index)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center text-sm text-slate-400 py-4 border border-dashed border-slate-200 rounded-lg">No products added yet.</div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3 bg-slate-50/50 -mx-5 px-5 pb-5 rounded-b-2xl">
              <h4 className="text-xs font-bold uppercase text-slate-500">New Product</h4>
              <div className="relative" ref={productDropdownRef}>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Product</label>
                <input
                  type="text"
                  placeholder="Search Code or Name..."
                  className="block w-full text-sm border-slate-200 rounded-lg border py-1.5 px-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={productSearchTerm}
                  onChange={(e) => {
                    setProductSearchTerm(e.target.value);
                    setIsProductDropdownOpen(true);
                    if (e.target.value === '') {
                      handleProductSelect('');
                    }
                  }}
                  onFocus={() => setIsProductDropdownOpen(true)}
                />
                {isProductDropdownOpen && (
                  <div className="absolute bottom-full mb-1 z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {products
                      .filter(p => {
                        const search = productSearchTerm.toLowerCase();
                        return (
                          p.name.toLowerCase().includes(search) ||
                          String(p.code || '').toLowerCase().includes(search)
                        );
                      })
                      .map(p => (
                        <div
                          key={p.id}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                          onClick={() => {
                            handleProductSelect(p.id);
                            setProductSearchTerm(`${p.name} ${p.code ? `(${p.code})` : ''}`);
                            setIsProductDropdownOpen(false);
                          }}
                        >
                          <div className="font-medium text-slate-800">{p.name}</div>
                          {p.code && <div className="text-xs text-slate-500">Code: {p.code}</div>}
                        </div>
                      ))}
                    {products.filter(p => {
                        const search = productSearchTerm.toLowerCase();
                        return (
                          p.name.toLowerCase().includes(search) ||
                          String(p.code || '').toLowerCase().includes(search)
                        );
                      }).length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-500">No products found</div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qty</label>
                  <input type="number" min="1" value={currentItem.qty || ''} onChange={e => handleCurrentItemChange('qty', parseFloat(e.target.value))} className="block w-full text-sm border-slate-200 rounded-lg border py-1.5 px-2 bg-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price</label>
                  <input type="number" value={currentItem.unitPrice || ''} onChange={e => handleCurrentItemChange('unitPrice', parseFloat(e.target.value))} className="block w-full text-sm border-slate-200 rounded-lg border py-1.5 px-2 bg-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tax %</label>
                  <input type="number" value={currentItem.taxPercentage || ''} onChange={e => handleCurrentItemChange('taxPercentage', parseFloat(e.target.value))} className="block w-full text-sm border-slate-200 rounded-lg border py-1.5 px-2 bg-white" />
                </div>
              </div>
              
              <button onClick={addItemRow} type="button" className="w-full mt-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-100 transition-colors flex justify-center items-center">
                <Plus className="w-4 h-4 mr-2" /> Add Product
              </button>
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
            className="print-container bg-white shadow-lg w-[210mm] min-h-[297mm] p-8 font-sans relative overflow-hidden z-0 flex flex-col"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Background Overlay */}
            {company?.logoUrl && (
              <div className="absolute inset-0 flex items-center justify-center z-[-1] opacity-5 pointer-events-none">
                <img src={company.logoUrl} crossOrigin="anonymous" alt="Watermark" className="w-[150mm] h-[150mm] object-contain grayscale" />
              </div>
            )}
            {/* Header */}
            <div className="border-b-2 border-gray-900 pb-2 mb-2">
              <div className="flex flex-row items-stretch justify-center relative mb-1">
                <div className="absolute left-0 top-0 bottom-0 flex justify-start -mt-2">
                  {company?.logoUrl && (
                    <img src={company.logoUrl} crossOrigin="anonymous" alt="Company Logo" className="h-full max-h-[96px] w-auto object-contain" />
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
              <div className="w-full bg-black text-white py-1.5 text-[16px] font-bold uppercase tracking-widest leading-none text-center pl-12">
                NTN: {company?.ntn} | STRN: {company?.strn}
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
                {selectedCustomerDetails ? (
                  <div className="text-[16px] leading-tight">
                    {(() => {
                      const code = selectedCustomerDetails.emisCode || selectedCustomerDetails.institutionCode || selectedCustomerDetails.healthUnitCode;
                      return (
                        <p className="font-bold text-gray-900 mb-0.5">
                          {code ? `${code}, ` : ''}{selectedCustomerDetails.name}
                        </p>
                      );
                    })()}
                    {(!selectedCustomerDetails.customerType || selectedCustomerDetails.customerType === 'other') && selectedCustomerDetails.ntn && (
                      <p><span className="font-semibold">NTN:</span> {selectedCustomerDetails.ntn}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 italic text-[11px]">Select a customer...</p>
                )}
              </div>
              <div className="text-right text-[11px] space-y-0.5">
                <p><span className="font-semibold text-gray-600">Invoice No:</span> <span className="text-[16px] font-bold text-gray-900">{invoiceNumber}</span></p>
                <p><span className="font-semibold text-gray-600">Date:</span> <span className="text-[16px] font-bold text-gray-900">{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                <div className="mt-2 inline-block">
                  {invoiceNumber && <Barcode value={invoiceNumber} width={1} height={25} displayValue={false} margin={0} renderer="canvas" />}
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-[13px] mb-4">
              <thead>
                <tr className="bg-gray-800 text-white text-left text-[14px]">
                  <th className="py-2 px-2">Sr.</th>
                  <th className="py-2 px-2">Description</th>
                  <th className="py-2 px-2 text-center">Qty</th>
                  <th className="py-2 px-2 text-right">Unit Price</th>
                  <th className="py-2 px-2 text-right">Total Excl. Tax</th>
                  <th className="py-2 px-2 text-center">Tax Rate</th>
                  <th className="py-2 px-2 text-right">Sales Tax</th>
                  <th className="py-2 px-2 text-right">Total Incl. Tax</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="py-2 px-2">{idx + 1}</td>
                    <td className="py-2 px-2 font-medium">{item.productName || '-'}</td>
                    <td className="py-2 px-2 text-center">{item.qty || 0}</td>
                    <td className="py-2 px-2 text-right">{(item.unitPrice || 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">{(item.total || 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-center">{item.taxPercentage || 0}%</td>
                    <td className="py-2 px-2 text-right">{(item.tax || 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-right font-semibold">{(item.grandTotal || 0).toLocaleString()}</td>
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
                
                <div className="mt-8 pt-4 border-t border-gray-200 flex justify-end items-end">
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
