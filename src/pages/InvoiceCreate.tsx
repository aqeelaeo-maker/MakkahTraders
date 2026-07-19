import React, { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, orderBy, addDoc, doc, getDoc, updateDoc, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Customer, Product, Invoice, InvoiceItem, CompanyProfile } from '../types';
import { Plus, Trash2, Save, Printer, Download, ArrowLeft, Pencil, X } from 'lucide-react';
import { useNavigate, Link, useParams, useSearchParams, useOutletContext } from 'react-router';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { QRCodeCanvas } from 'qrcode.react';
import Barcode from 'react-barcode';
import { format } from 'date-fns';

const InvoicePreview = React.memo(({ 
  invoiceTitle, 
  index,
  company,
  selectedCustomerDetails,
  invoiceNumber,
  fbrInvoiceNo,
  items,
  subtotal,
  totalTax,
  discount,
  netTotal
}: any) => {
  return (
    <div 
      key={index}
      className={`bg-white shadow-lg print:shadow-none w-[210mm] min-h-[297mm] p-8 font-sans relative overflow-hidden flex flex-col box-border ${index > 0 ? 'break-before-page mt-8 print:mt-0' : ''}`}
    >
      {/* Background Overlay */}
      {!company?.printOnLetterPad && company?.logoUrl && (
        <div className="absolute inset-0 flex items-center justify-center z-0 opacity-10 pointer-events-none">
          <img src={company.logoUrl} crossOrigin="anonymous" alt="Watermark" className="w-[150mm] h-[150mm] object-contain grayscale" />
        </div>
      )}
      {/* Header */}
      {!company?.printOnLetterPad && (
        <div className="border-b-2 border-gray-900 pb-2 mb-2 relative z-10">
          <div className="flex flex-row items-stretch justify-center relative mb-1">
            <div className="absolute left-0 top-0 bottom-0 flex justify-start -mt-2">
              {company?.logoUrl && (
                <img src={company.logoUrl} crossOrigin="anonymous" alt="Company Logo" className="h-full max-h-[96px] w-auto object-contain" />
              )}
            </div>
            <div className="flex flex-col items-center justify-between text-center min-h-[72px] pl-12">
              <h1 className="font-serif text-[52px] whitespace-nowrap font-black text-gray-900 uppercase tracking-tighter leading-none underline decoration-4 underline-offset-8 mb-3">
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
      )}
      {/* Title if Letter Pad */}
      {company?.printOnLetterPad && (
        <div className="pb-2 mb-4 relative z-10" style={{ marginTop: company.headerLength ? `${company.headerLength}mm` : '5rem' }}>
          <div className="w-full bg-black text-white py-1.5 text-[16px] font-bold uppercase tracking-widest leading-none text-center">
            {invoiceTitle}
          </div>
        </div>
      )}

      {/* Customer Info & Invoice Details */}
      <div className="flex justify-between items-start mb-1 relative z-10">
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
        <div className="flex flex-col items-end">
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 items-center text-left min-w-[200px]">
            <span className="font-semibold text-gray-600">Invoice No:</span>
            <span className="text-[16px] font-bold text-gray-900 leading-none text-right">{invoiceNumber}</span>
            
            <span className="font-semibold text-gray-600">Date:</span>
            <span className="border-b border-gray-900 w-full"></span>
            
            {fbrInvoiceNo && (
              <>
                <span className="font-semibold text-gray-600">FBR Inv No:</span>
                <span className="text-[14px] font-bold text-gray-900 leading-none text-right">{fbrInvoiceNo}</span>
              </>
            )}
          </div>
          <div className="mt-2 inline-block">
            {invoiceNumber && <Barcode value={invoiceNumber} width={1} height={25} displayValue={false} margin={0} renderer="canvas" />}
          </div>
        </div>
      </div>

      <div className="text-center mb-4 mt-2 relative z-10">
        <h2 className="text-4xl font-black text-black uppercase tracking-widest leading-none">{invoiceTitle}</h2>
      </div>

      {/* Table */}
      {invoiceTitle === 'SALES TAX INVOICE' ? (
        <table className="w-full text-[13px] mb-4 relative z-10">
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
            {items.map((item: any, idx: number) => (
              <tr key={idx} className="border-b border-gray-800">
                <td className="py-2 px-2">{idx + 1}</td>
                <td className="py-2 px-2 font-medium">{item.productName || '-'}</td>
                <td className="py-2 px-2 text-center">{item.qty || 0}</td>
                <td className="py-2 px-2 text-right">{(item.unitPrice || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                <td className="py-2 px-2 text-right">{(item.total || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                <td className="py-2 px-2 text-center">{item.taxPercentage || 0}%</td>
                <td className="py-2 px-2 text-right">{(item.tax || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                <td className="py-2 px-2 text-right font-semibold">{(item.grandTotal || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-[13px] mb-4 relative z-10 border-collapse border border-gray-800">
          <thead>
            <tr className="bg-gray-800 text-white text-center text-[15px]">
              <th className="py-3 px-2 border border-gray-800">Description</th>
              <th className="py-3 px-2 border border-gray-800 w-[20%]">Value Excluding Sales Tax</th>
              <th className="py-3 px-2 border border-gray-800 w-[20%]">Sales Tax Payment</th>
              <th className="py-3 px-2 border border-gray-800 w-[20%]">Value Including Sales tax</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-6 px-4 font-bold text-[18px] text-center border border-gray-800">GST against Bill No {invoiceNumber}</td>
              <td className="py-6 px-4 font-bold text-[18px] text-center border border-gray-800">{subtotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
              <td className="py-6 px-4 font-bold text-[18px] text-center border border-gray-800">{totalTax.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
              <td className="py-6 px-4 font-bold text-[18px] text-center border border-gray-800">{(subtotal + totalTax).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Totals & Footer Info */}
      <div className="flex justify-end items-start mt-auto pt-4 border-t border-gray-200 relative z-10">
        <div className="w-[60%]">
          <div className="bg-gray-50 p-3 rounded border border-gray-300 text-[14px]">
            <div className="flex justify-between py-1.5 items-center">
              <span className="font-bold text-gray-700 text-[18px]">Total Excl. Sales Tax:</span>
              <span className="font-bold text-[20px]">{subtotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-300 items-center">
              <span className="font-bold text-gray-700 text-[18px]">Total Sales Tax:</span>
              <span className="font-bold text-[20px]">{totalTax.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between py-1.5 border-b border-gray-300 text-red-600 items-center">
                <span className="font-bold text-[18px]">Discount:</span>
                <span className="font-bold text-[20px]">-{discount.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            <div className="flex justify-between py-3 text-[18px] font-black text-gray-900 items-center">
              <span>Total Value Incl. Tax:</span>
              <span>PKR {netTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
          
          <div className="mt-8 pt-4 border-t border-gray-200 flex justify-end items-end">
            <div className="inline-block text-center">
              <div className="w-full border-b border-gray-800 mb-1"></div>
              <span className="text-[12px] text-gray-700 font-bold uppercase tracking-wider">Authorized Signatory</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function InvoiceCreate() {
  const { activeSubUser } = useOutletContext<any>() || {};
  const navigate = useNavigate();
  const { id } = useParams();
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = () => {
    window.print();
  };

  const [loading, setLoading] = useState(false);
  const [fbrStatus, setFbrStatus] = useState<'Pending' | 'Submitted' | 'Failed' | undefined>(undefined);
  const [fbrInvoiceNo, setFbrInvoiceNo] = useState<string | undefined>(undefined);
  const [fbrModalData, setFbrModalData] = useState<{submitted: any, response: any} | null>(null);
  
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
  const [editItemIndex, setEditItemIndex] = useState<number | null>(null);
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
          setFbrStatus(invData.fbrStatus);
          setFbrInvoiceNo(invData.fbrInvoiceNo);
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
    if (editItemIndex !== null) {
      const newItems = [...items];
      newItems[editItemIndex] = { ...currentItem, id: newItems[editItemIndex].id };
      setItems(newItems);
      setEditItemIndex(null);
    } else {
      setItems([...items, { ...currentItem, id: Math.random().toString() }]);
    }
    setCurrentItem({ qty: 1, unitPrice: 0, taxPercentage: 18, total: 0, tax: 0, grandTotal: 0 });
    setProductSearchTerm('');
    setIsProductDropdownOpen(false);
  };

  const editItemRow = (index: number) => {
    setCurrentItem(items[index]);
    setEditItemIndex(index);
    setProductSearchTerm(items[index].productName || '');
  };

  const removeItemRow = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
    if (editItemIndex === index) {
      setEditItemIndex(null);
      setCurrentItem({ qty: 1, unitPrice: 0, taxPercentage: 18, total: 0, tax: 0, grandTotal: 0 });
      setProductSearchTerm('');
    } else if (editItemIndex !== null && index < editItemIndex) {
      setEditItemIndex(editItemIndex - 1);
    }
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

  const handleTaxAmountChange = (value: number) => {
    const tax = isNaN(value) ? 0 : value;
    const qty = currentItem.qty || 0;
    const unitPrice = currentItem.unitPrice || 0;
    const total = Math.round(qty * unitPrice);
    
    const grandTotal = total + tax;
    
    setCurrentItem({ ...currentItem, total, tax, grandTotal });
  };

  const updateCurrentItemCalculations = (item: Partial<InvoiceItem>) => {
    const qty = item.qty || 0;
    const unitPrice = item.unitPrice || 0;
    const taxPerc = item.taxPercentage || 0;
    
    const total = Math.round(qty * unitPrice);
    const tax = Math.round((total * taxPerc) / 100);
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
      return null;
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
        createdBy: activeSubUser?.username || auth.currentUser?.uid || 'unknown',
        status,
        fbrStatus,
        fbrInvoiceNo
      };

      if (invoiceData.fbrStatus === undefined) delete invoiceData.fbrStatus;
      if (invoiceData.fbrInvoiceNo === undefined) delete invoiceData.fbrInvoiceNo;

      if (id) {
        await updateDoc(doc(db, 'invoices', id), invoiceData);
        return id;
      } else {
        const docRef = await addDoc(collection(db, 'invoices'), invoiceData);
        return docRef.id;
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save invoice");
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveAndExit = async () => {
    const savedId = await handleSave();
    if (savedId) navigate('/invoices');
  }

  const submitToFBR = async () => {
    console.log("Submitting to FBR...");
    setLoading(true);
    let objinvoice: any = null;
    try {
      objinvoice = {
        "invoiceType": "Sale Invoice",
        "invoiceDate": "2025-06-14",
        "sellerNTNCNIC": company?.ntn?.replace(/[^0-9]/g, '') || "8885801",
        "sellerBusinessName": company?.name || "Company 8",
        "sellerProvince": "Sindh",
        "sellerAddress": company?.address || "Karachi",
        "buyerNTNCNIC": "1000000000056",
        "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
        "buyerProvince": "Sindh",
        "buyerAddress": "Karachi",
        "invoiceRefNo": invoiceNumber || "SI-20250421-001",
        "scenarioId": "SN018",
        "buyerRegistrationType": "Unregistered",
        "items": [
          {
            "hsCode": "0101.2100",
            "productDescription": "TEST",
            "rate": "8%",
            "uoM": "Numbers, pieces, units",
            "quantity": 20,
            "totalValues": 0,
            "valueSalesExcludingST": 1000,
            "salesTaxApplicable": 80,
            "fixedNotifiedValueOrRetailPrice": 0,
            "salesTaxWithheldAtSource": 0,
            "extraTax": 0,
            "furtherTax": 0,
            "sroScheduleNo": "",
            "fedPayable": 0,
            "discount": 0,
            "saleType": "Services (FED in ST Mode)",
            "sroItemSerialNo": ""
          }
        ]
      };

      const response = await fetch("/api/fbr/invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(objinvoice)
      });
      
      const resData = await response.json();
      
      setFbrModalData({ submitted: objinvoice, response: resData });
      
    } catch (err: any) {
      setFbrModalData({ submitted: objinvoice || null, response: { error: err.message } });
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
            type="button"
            onClick={submitToFBR}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors flex items-center disabled:opacity-50"
          >
            TestFBR
          </button>
          
          <button 
            onClick={handleSaveAndExit}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" /> Save Invoice
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Editor Form */}
        <div className="w-full space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col h-full">
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

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col h-full">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Items</h3>
            </div>
            
            <div className="space-y-2 flex-1 max-h-96 overflow-y-auto">
              {items.map((item, index) => (
                <div key={item.id} className="flex justify-between items-center border border-slate-100 bg-slate-50/50 rounded-lg p-2 group">
                  <div className="text-sm">
                    <span className="font-semibold text-slate-700">{item.productName}</span>
                    <span className="text-slate-500 text-xs ml-2">({item.qty} x Rs {item.unitPrice})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-800">Rs {(item.total || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    <button 
                      onClick={() => editItemRow(index)}
                      className="text-indigo-400 hover:text-indigo-600 transition-colors p-1"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
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
              <div className="grid grid-cols-4 gap-2">
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
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tax Amt</label>
                  <input type="number" value={currentItem.tax || ''} onChange={e => handleTaxAmountChange(parseFloat(e.target.value))} className="block w-full text-sm border-slate-200 rounded-lg border py-1.5 px-2 bg-white" />
                </div>
              </div>
              
              <button onClick={addItemRow} type="button" className="w-full mt-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-100 transition-colors flex justify-center items-center">
                <Plus className="w-4 h-4 mr-2" /> {editItemIndex !== null ? 'Update Product' : 'Add Product'}
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2 mt-auto">
              <div className="flex justify-between text-sm items-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Discount</span>
                <input type="number" value={discount} onChange={e => setDiscount(Math.round(parseFloat(e.target.value)) || 0)} className="w-24 text-right border-slate-200 rounded-lg border px-2 py-1 text-sm bg-slate-50 focus:outline-none" />
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Invoice Preview (A4 Scale approximation) */}
        <div className="w-full overflow-x-auto bg-gray-100 p-4 rounded-lg flex flex-col items-center gap-8">
          <div 
            ref={invoiceRef} 
            className="print-container flex flex-col z-0 w-[210mm]"
          >
            {['SALES TAX INVOICE', 'BILL INVOICE'].map((invoiceTitle, index) => (
              <InvoicePreview
                key={index}
                invoiceTitle={invoiceTitle}
                index={index}
                company={company}
                selectedCustomerDetails={selectedCustomerDetails}
                invoiceNumber={invoiceNumber}
                fbrInvoiceNo={fbrInvoiceNo}
                items={items}
                subtotal={subtotal}
                totalTax={totalTax}
                discount={discount}
                netTotal={netTotal}
              />
            ))}
          </div>
        </div>
      </div>

      {/* FBR Modal */}
      {fbrModalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">FBR Submission Details</h3>
              <button 
                onClick={() => setFbrModalData(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Submitted JSON Data</h4>
                <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-left">
                  <pre className="text-xs text-emerald-400 font-mono text-left">
                    {JSON.stringify(fbrModalData.submitted, null, 2)}
                  </pre>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Response Data</h4>
                <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-left">
                  <pre className="text-xs text-blue-400 font-mono text-left">
                    {JSON.stringify(fbrModalData.response, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setFbrModalData(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
