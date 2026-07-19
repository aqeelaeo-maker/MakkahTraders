import { Invoice, CompanyProfile, Customer, Product } from '../types';

export function mapInvoiceToFbrPayload(
  invoice: Omit<Invoice, 'id'>, 
  company: CompanyProfile, 
  customer: Customer,
  products: Product[]
) {
  const invoiceDate = new Date(invoice.date).toISOString().split('T')[0];
  
  // Format NTN (remove dashes if FBR requires 0000000000000 format, or keep them if they accept it)
  // According to sample, it's a 13 digit CNIC or 7-9 digit NTN. Let's just strip non-alphanumeric.
  const cleanSellerNtn = (company.ntn || '').replace(/[^a-zA-Z0-9]/g, '');
  const cleanBuyerNtn = (customer.ntn || '').replace(/[^a-zA-Z0-9]/g, '');

  const items = invoice.items.map(item => {
    const product = products.find(p => p.id === item.productId);
    
    return {
      hsCode: "0000.0000", // Default HS code if not available in Product
      productDescription: item.productName || "",
      rate: `${item.taxPercentage || 0}%`, // Or maybe just number? The sample shows "0%" string
      uoM: product?.unit || "Nos",
      quantity: item.qty || 0,
      totalValues: item.grandTotal || 0, // Total including tax
      valueSalesExcludingST: item.total || 0,
      fixedNotifiedValueOrRetailPrice: 0,
      salesTaxApplicable: item.tax || 0,
      salesTaxWithheldAtSource: 0,
      extraTax: "",
      furtherTax: 0,
      sroScheduleNo: "",
      fedPayable: 0,
      discount: 0,
      saleType: "",
      sroItemSerialNo: ""
    };
  });

  return {
    invoiceType: "Sale Invoice",
    invoiceDate,
    sellerNTNCNIC: cleanSellerNtn,
    sellerBusinessName: company.name || "",
    sellerProvince: "Punjab", // Default or extract from address
    sellerAddress: company.address || "",
    buyerNTNCNIC: cleanBuyerNtn,
    buyerBusinessName: customer.name || "",
    buyerProvince: "Punjab",
    buyerAddress: customer.address || "",
    buyerRegistrationType: cleanBuyerNtn ? "Registered" : "Unregistered Person",
    invoiceRefNo: invoice.invoiceNumber,
    scenarioId: "SN000",
    items
  };
}
