import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { db, auth } from '../firebase';
import { writeBatch, doc } from 'firebase/firestore';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  onImportSuccess: (importedCount: number, updatedCount: number) => void;
}

interface ParsedProductRow {
  rowNumber: number;
  data: Partial<Product>;
  isValid: boolean;
  validationError?: string;
  matchedExisting?: Product;
}

type DuplicateMode = 'update' | 'skip' | 'add_all';

const SCENARIO_CODES = Array.from({ length: 28 }, (_, i) => `SN${String(i + 1).padStart(3, '0')}`);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseString(val: any, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

// Complete value as text for HS Code (preserves leading zeros, dots, formats, and avoids exponential truncation)
function parseHsCode(formattedVal: any, rawVal?: any): string {
  let str = '';
  // 1. Prefer formattedVal (from cell.w via raw: false) which captures the cell's complete visible text in Excel
  if (formattedVal !== null && formattedVal !== undefined) {
    str = String(formattedVal).trim();
  }
  // 2. Fallback to rawVal if formattedVal was empty
  if (!str && rawVal !== null && rawVal !== undefined) {
    str = String(rawVal).trim();
  }
  if (!str) return '';

  // Remove any wrapping quotes or leading apostrophe used in Excel to force text format ('0101.2900)
  str = str.replace(/^['"]|['"]$/g, '').trim();

  // Handle scientific exponential notation if Excel produced e.g. "1.0129E+07" or "8.4713E+07"
  if (/[eE][+-]?[0-9]+/.test(str) && typeof rawVal === 'number' && !isNaN(rawVal)) {
    try {
      str = rawVal.toLocaleString('fullwide', { useGrouping: false });
    } catch {
      str = rawVal.toFixed(0);
    }
  }

  // If 7 digits without dot (e.g. "1012900"), Excel likely dropped the leading 0 from an 8-digit PCT code ("01012900")
  if (/^\d{7}$/.test(str)) {
    str = '0' + str;
  }
  // If 3 digits before dot (e.g. "101.2900" or "401.1000"), Excel dropped leading zero from 4-digit heading ("0101.2900" or "0401.1000")
  else if (/^\d{3}\.\d+$/.test(str)) {
    str = '0' + str;
  }
  // If Excel stripped trailing zeros from a 4.4 PCT code (e.g. "0101.29" -> "0101.2900", or "6203.42" -> "6203.4200")
  if (/^\d{4}\.\d{1,3}$/.test(str)) {
    const [heading, sub] = str.split('.');
    str = `${heading}.${sub.padEnd(4, '0')}`;
  }

  return str;
}

function parseNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? fallback : num;
}

// Download a ready-to-use template for products
export function downloadProductExcelTemplate() {
  const headers = [
    'Product Name',
    'Item Code',
    'HS Code',
    'Scenario Code',
    'Sale Type',
    'Category',
    'Unit',
    'Sale Price',
    'Purchase Price',
    'Tax %',
    'Fixed / Retail Price',
    'Current Stock',
    'Minimum Stock',
    'SRO Item Serial No',
    'SRO Schedule No'
  ];

  const sampleData = [
    [
      'School Uniform Set (Medium)',
      'UNI-MED-01',
      '6203.4200',
      'SN001',
      'Goods at standard rate',
      'Uniforms',
      'pcs',
      3200,
      2400,
      18,
      0,
      100,
      15,
      '',
      ''
    ],
    [
      'A4 Printing Paper 80GSM (Ream)',
      'PPR-A4-80',
      '4802.5600',
      'SN001',
      'Goods at standard rate',
      'Stationery',
      'Packet',
      1450,
      1150,
      18,
      0,
      250,
      25,
      '',
      ''
    ],
    [
      'Executive Ballpoint Pens (Pack of 10)',
      'PEN-EX-10',
      '9608.1000',
      'SN001',
      'Goods at standard rate',
      'Stationery',
      'Box',
      650,
      450,
      18,
      0,
      120,
      20,
      '',
      ''
    ],
    [
      'Student Wooden Desk with Chair',
      'FUR-DSK-01',
      '9403.6000',
      'SN001',
      'Goods at standard rate',
      'Furniture',
      'Nos',
      8500,
      6800,
      18,
      0,
      40,
      5,
      '',
      ''
    ]
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

  // Set column widths for comfortable viewing in Excel
  ws['!cols'] = [
    { wch: 35 }, // Product Name
    { wch: 16 }, // Item Code
    { wch: 14 }, // HS Code
    { wch: 15 }, // Scenario Code
    { wch: 25 }, // Sale Type
    { wch: 16 }, // Category
    { wch: 10 }, // Unit
    { wch: 12 }, // Sale Price
    { wch: 14 }, // Purchase Price
    { wch: 10 }, // Tax %
    { wch: 20 }, // Fixed / Retail Price
    { wch: 14 }, // Current Stock
    { wch: 14 }, // Minimum Stock
    { wch: 20 }, // SRO Item Serial No
    { wch: 20 }  // SRO Schedule No
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products Template');
  XLSX.writeFile(wb, 'products_import_template.xlsx');
}

// Export existing products to Excel
export function exportProductsToExcel(products: Product[]) {
  const data = products.map(p => ({
    'Product Name': p.name || '',
    'Item Code': p.code || '',
    'HS Code': p.hsCode || '',
    'Scenario Code': p.scenarioCode || 'SN001',
    'Sale Type': p.saleType || '',
    'Category': p.category || '',
    'Unit': p.unit || 'pcs',
    'Sale Price': p.salePrice || 0,
    'Purchase Price': p.purchasePrice || 0,
    'Tax %': p.taxPercentage || 0,
    'Fixed / Retail Price': p.fixedNotifiedValueOrRetailPrice || 0,
    'Current Stock': p.currentStock || 0,
    'Minimum Stock': p.minimumStock || 0,
    'SRO Item Serial No': p.sroItemSerialNo || '',
    'SRO Schedule No': p.sroScheduleNo || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 35 },
    { wch: 16 },
    { wch: 14 },
    { wch: 15 },
    { wch: 25 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `products_export_${dateStr}.xlsx`);
}

export default function ImportProductsModal({
  isOpen,
  onClose,
  existingProducts,
  onImportSuccess
}: ImportProductsModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('update');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setErrorMsg(null);
    setImportProgress(null);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = (file: File) => {
    setErrorMsg(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('The uploaded Excel file has no sheets.');
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          throw new Error('No data rows found in the uploaded file.');
        }

        // Map existing products for duplicate lookup
        const codeMap = new Map<string, Product>();
        const nameMap = new Map<string, Product>();

        existingProducts.forEach(p => {
          if (p.code && p.code.trim()) {
            codeMap.set(p.code.trim().toLowerCase(), p);
          }
          if (p.name && p.name.trim()) {
            nameMap.set(p.name.trim().toLowerCase(), p);
          }
        });

        // Parse each row
        const rows: ParsedProductRow[] = rawJson.map((row, idx) => {
          const item: Partial<Product> = {};

          // Field matching dictionary
          Object.keys(row).forEach(rawKey => {
            const key = normalizeKey(rawKey);
            const val = row[rawKey];

            // Product Name
            if (['productname', 'name', 'itemname', 'item', 'description', 'product', 'title', 'itemdescription'].includes(key)) {
              item.name = parseString(val);
            }
            // Code / SKU
            else if (['code', 'itemcode', 'productcode', 'sku', 'itemno', 'itemnumber', 'partnumber', 'barcode', 'artno', 'articleno'].includes(key)) {
              item.code = parseString(val);
            }
            // HS Code
            else if (['hscode', 'hs', 'pctcode', 'pct', 'harmonizedcode', 'tariffcode', 'hscodes'].includes(key)) {
              item.hsCode = parseString(val);
            }
            // Scenario Code
            else if (['scenariocode', 'scenario', 'scenariono'].includes(key)) {
              let sc = parseString(val).toUpperCase();
              if (sc && !sc.startsWith('SN') && !isNaN(Number(sc))) {
                sc = `SN${String(Number(sc)).padStart(3, '0')}`;
              }
              item.scenarioCode = sc || 'SN001';
            }
            // Sale Type
            else if (['saletype', 'typeofsale', 'salestype', 'natureofsale'].includes(key)) {
              item.saleType = parseString(val);
            }
            // SRO Item Serial No
            else if (['sroitemserialno', 'sroserialno', 'sroserial', 'sroitemserial', 'srono'].includes(key)) {
              item.sroItemSerialNo = parseString(val);
            }
            // SRO Schedule No
            else if (['sroscheduleno', 'sroschedule', 'scheduleno', 'schedule'].includes(key)) {
              item.sroScheduleNo = parseString(val);
            }
            // Category
            else if (['category', 'productcategory', 'itemcategory', 'group', 'productgroup', 'department'].includes(key)) {
              item.category = parseString(val);
            }
            // Unit
            else if (['unit', 'uom', 'unitofmeasure', 'unitofmeasurement', 'measure', 'qtyunit', 'packaging'].includes(key)) {
              item.unit = parseString(val);
            }
            // Sale Price
            else if (['saleprice', 'price', 'unitprice', 'sellingprice', 'rate', 'salesprice', 'mrp', 'retailprice', 'amount'].includes(key)) {
              item.salePrice = parseNumber(val, 0);
            }
            // Purchase Price
            else if (['purchaseprice', 'costprice', 'cost', 'buyingprice', 'buyprice', 'purchasecost'].includes(key)) {
              item.purchasePrice = parseNumber(val, 0);
            }
            // Tax %
            else if (['taxpercentage', 'taxpercent', 'taxrate', 'tax', 'salestax', 'salestaxrate', 'salestaxpercent', 'vat', 'gst'].includes(key)) {
              item.taxPercentage = parseNumber(val, 0);
            }
            // Fixed / Retail Price
            else if (['fixednotifiedvalueorretailprice', 'fixednotifiedvalue', 'notifiedvalue', 'retailprice', 'fixedvalue', 'notifiedprice'].includes(key)) {
              item.fixedNotifiedValueOrRetailPrice = parseNumber(val, 0);
            }
            // Current Stock
            else if (['currentstock', 'stock', 'quantity', 'qty', 'stockqty', 'inventory', 'balance', 'openingstock', 'stockonhand'].includes(key)) {
              item.currentStock = parseNumber(val, 0);
            }
            // Minimum Stock
            else if (['minimumstock', 'minstock', 'reorderpoint', 'reorderlevel', 'alertstock', 'minqty'].includes(key)) {
              item.minimumStock = parseNumber(val, 0);
            }
          });

          // Set defaults
          if (!item.scenarioCode) item.scenarioCode = 'SN001';
          if (!item.unit) item.unit = 'pcs';
          if (!item.category) item.category = 'General';
          if (item.salePrice === undefined) item.salePrice = 0;
          if (item.purchasePrice === undefined) item.purchasePrice = 0;
          if (item.taxPercentage === undefined) item.taxPercentage = 0;
          if (item.currentStock === undefined) item.currentStock = 0;
          if (item.minimumStock === undefined) item.minimumStock = 0;

          // Validation
          let isValid = true;
          let validationError: string | undefined;

          if (!item.name || item.name.trim() === '') {
            isValid = false;
            validationError = 'Product Name is missing';
          }

          // Check if matches existing product
          let matchedExisting: Product | undefined;
          if (item.code && codeMap.has(item.code.toLowerCase())) {
            matchedExisting = codeMap.get(item.code.toLowerCase());
          } else if (item.name && nameMap.has(item.name.toLowerCase())) {
            matchedExisting = nameMap.get(item.name.toLowerCase());
          }

          return {
            rowNumber: idx + 2, // Excel 1-based, plus 1 for header
            data: item,
            isValid,
            validationError,
            matchedExisting
          };
        });

        setParsedRows(rows);
        setStep('preview');
      } catch (err: any) {
        console.error('Error parsing excel:', err);
        setErrorMsg(err.message || 'Failed to read Excel file. Please ensure it is a valid .xlsx or .xls file.');
      }
    };

    reader.onerror = () => {
      setErrorMsg('Failed to read the file from disk.');
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Perform Firestore Batch Import
  const handleConfirmImport = async () => {
    if (!auth.currentUser) {
      setErrorMsg('You must be logged in to import products.');
      return;
    }

    const userId = auth.currentUser.uid;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // Filter out invalid rows
      const validRows = parsedRows.filter(r => r.isValid);

      // Determine which items to save based on duplicateMode
      const productsToSave: Product[] = [];
      let updatedCount = 0;
      let newCount = 0;

      validRows.forEach((row, i) => {
        const item = row.data;
        const matched = row.matchedExisting;

        if (matched && duplicateMode === 'skip') {
          // Skip this item
          return;
        }

        let docId: string;
        if (matched && duplicateMode === 'update') {
          docId = matched.id;
          updatedCount++;
        } else {
          docId = `PROD-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
          newCount++;
        }

        const productRecord: Product = {
          id: docId,
          userId: userId,
          code: item.code || '',
          hsCode: item.hsCode || '',
          scenarioCode: item.scenarioCode || 'SN001',
          saleType: item.saleType || '',
          sroItemSerialNo: item.sroItemSerialNo || '',
          sroScheduleNo: item.sroScheduleNo || '',
          fixedNotifiedValueOrRetailPrice: item.fixedNotifiedValueOrRetailPrice || 0,
          name: item.name || '',
          category: item.category || 'General',
          unit: item.unit || 'pcs',
          purchasePrice: item.purchasePrice || 0,
          salePrice: item.salePrice || 0,
          taxPercentage: item.taxPercentage || 0,
          currentStock: item.currentStock || 0,
          minimumStock: item.minimumStock || 0,
        };

        productsToSave.push(productRecord);
      });

      if (productsToSave.length === 0) {
        throw new Error('No eligible products to import. All rows were either invalid or skipped based on your duplicate settings.');
      }

      // Batch write in chunks of 400
      const CHUNK_SIZE = 400;
      const total = productsToSave.length;
      setImportProgress({ current: 0, total });

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = productsToSave.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach(p => {
          const docRef = doc(db, 'products', p.id);
          batch.set(docRef, p);
        });

        await batch.commit();
        setImportProgress({ current: Math.min(i + CHUNK_SIZE, total), total });
      }

      onImportSuccess(newCount, updatedCount);
      handleClose();
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMsg(err.message || 'An error occurred while saving products to database.');
    } finally {
      setIsProcessing(false);
      setImportProgress(null);
    }
  };

  // Preview stats
  const totalRows = parsedRows.length;
  const validRowsCount = parsedRows.filter(r => r.isValid).length;
  const invalidRowsCount = totalRows - validRowsCount;
  const matchedCount = parsedRows.filter(r => r.isValid && r.matchedExisting).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-slate-900/60 backdrop-blur-sm"
          onClick={!isProcessing ? handleClose : undefined}
        />

        <div className="relative inline-block w-full max-w-4xl p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-2xl sm:my-8 border border-slate-100">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Import Products from Excel
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Upload an Excel (.xlsx, .xls) or CSV file to bulk import or update your product catalog
                </p>
              </div>
            </div>
            {!isProcessing && (
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* STEP 1: Upload & Template */}
          {step === 'upload' && (
            <div className="mt-6 space-y-6">
              {/* Template Banner */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">Need the standard Excel format?</span>
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Download our ready-made template with all required columns and sample rows.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadProductExcelTemplate}
                  className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-colors flex-shrink-0"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download Excel Template
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <div className="w-14 h-14 bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-700 text-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-800 mb-1">
                  Click to browse or drag and drop your Excel file here
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) files
                </p>
                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-semibold">
                  Automatic column mapping enabled
                </span>
              </div>

              {/* Column Reference Guide */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Recognized Column Headers
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-900">Product Name *</span>
                    <span className="text-[11px] text-slate-500 block">Required column</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Item Code</span>
                    <span className="text-[11px] text-slate-500 block">SKU / Code</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">HS Code</span>
                    <span className="text-[11px] text-slate-500 block">e.g. 6203.4200</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Sale Price</span>
                    <span className="text-[11px] text-slate-500 block">Default: 0</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Purchase Price</span>
                    <span className="text-[11px] text-slate-500 block">Default: 0</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Tax %</span>
                    <span className="text-[11px] text-slate-500 block">e.g. 18</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Category</span>
                    <span className="text-[11px] text-slate-500 block">Default: General</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Unit</span>
                    <span className="text-[11px] text-slate-500 block">pcs, kg, Box, etc.</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Current Stock</span>
                    <span className="text-[11px] text-slate-500 block">Default: 0</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Settings */}
          {step === 'preview' && (
            <div className="mt-5 space-y-5">
              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">File Rows</div>
                  <div className="text-xl font-black text-slate-900">{totalRows}</div>
                  <div className="text-[10px] text-slate-500 truncate">{fileName}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase">Valid Items</div>
                  <div className="text-xl font-black text-emerald-800">{validRowsCount}</div>
                  <div className="text-[10px] text-emerald-600 font-medium">Ready to import</div>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-indigo-700 uppercase">Matches Existing</div>
                  <div className="text-xl font-black text-indigo-800">{matchedCount}</div>
                  <div className="text-[10px] text-indigo-600 font-medium">Matched by Code/Name</div>
                </div>
                <div className={`rounded-xl p-3 border ${invalidRowsCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  <div className="text-[11px] font-bold uppercase">Invalid Rows</div>
                  <div className="text-xl font-black">{invalidRowsCount}</div>
                  <div className="text-[10px] font-medium">{invalidRowsCount > 0 ? 'Will be skipped' : 'All rows valid'}</div>
                </div>
              </div>

              {/* Duplicate Handling Options */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Duplicate Product Handling
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label
                    className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      duplicateMode === 'update'
                        ? 'border-indigo-500 bg-white shadow-sm ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="duplicateMode"
                      value="update"
                      checked={duplicateMode === 'update'}
                      onChange={() => setDuplicateMode('update')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="ml-2">
                      <div className="text-xs font-bold text-slate-900">Update Existing</div>
                      <div className="text-[10px] text-slate-500">Update price & stock of existing products</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      duplicateMode === 'skip'
                        ? 'border-indigo-500 bg-white shadow-sm ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="duplicateMode"
                      value="skip"
                      checked={duplicateMode === 'skip'}
                      onChange={() => setDuplicateMode('skip')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="ml-2">
                      <div className="text-xs font-bold text-slate-900">Skip Existing</div>
                      <div className="text-[10px] text-slate-500">Keep existing products unchanged</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      duplicateMode === 'add_all'
                        ? 'border-indigo-500 bg-white shadow-sm ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="duplicateMode"
                      value="add_all"
                      checked={duplicateMode === 'add_all'}
                      onChange={() => setDuplicateMode('add_all')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="ml-2">
                      <div className="text-xs font-bold text-slate-900">Add All as New</div>
                      <div className="text-[10px] text-slate-500">Create new items even if duplicated</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Parsed Items Preview ({parsedRows.length} rows)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Showing first {Math.min(parsedRows.length, 50)} rows
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/75 sticky top-0 border-b border-slate-200 text-slate-600 text-[11px] font-bold">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Product Name</th>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Unit</th>
                        <th className="px-3 py-2 text-right">Sale Price</th>
                        <th className="px-3 py-2 text-right">Tax %</th>
                        <th className="px-3 py-2 text-right">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, 50).map((row, idx) => {
                        const isMatch = Boolean(row.matchedExisting);
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50 transition-colors ${
                              !row.isValid ? 'bg-red-50/40 text-red-900' : ''
                            }`}
                          >
                            <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">
                              {row.rowNumber}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {!row.isValid ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Invalid
                                </span>
                              ) : isMatch ? (
                                duplicateMode === 'update' ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Will Update
                                  </span>
                                ) : duplicateMode === 'skip' ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Will Skip
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    New
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  New
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-bold text-slate-900">
                              {row.data.name || (
                                <span className="text-red-500 italic">Empty Name</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600">
                              {row.data.code || '-'}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {row.data.category || 'General'}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {row.data.unit || 'pcs'}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">
                              {Number(row.data.salePrice || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right text-indigo-600 font-semibold">
                              {row.data.taxPercentage ? `${row.data.taxPercentage}%` : '0%'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-700">
                              {row.data.currentStock || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Progress bar if processing */}
              {isProcessing && importProgress && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs font-bold text-indigo-900">
                    <span>Importing Products into Database...</span>
                    <span>{importProgress.current} / {importProgress.total}</span>
                  </div>
                  <div className="w-full bg-indigo-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round((importProgress.current / importProgress.total) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            {step === 'preview' ? (
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Choose Another File
              </button>
            ) : (
              <div className="text-xs text-slate-400">
                Ensure your column headers match standard field names.
              </div>
            )}

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              {step === 'preview' && (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isProcessing || validRowsCount === 0}
                  className="flex items-center px-6 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Import {validRowsCount} Products
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
