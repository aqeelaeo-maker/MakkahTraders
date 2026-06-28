import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "aesthetic-decorator-t5g21",
  appId: "1:67276714140:web:24cf8fdc2112f8d2893d59",
  apiKey: "AIzaSyAD0b58Nj_QjQ1-L0BKyOxE_JolKYFTxsQ",
  authDomain: "aesthetic-decorator-t5g21.firebaseapp.com",
  storageBucket: "aesthetic-decorator-t5g21.firebasestorage.app",
  messagingSenderId: "67276714140",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-0b5ff2ed-a27b-49d0-bb7b-2fe2233c8564");

async function seed() {
  console.log("Seeding data...");

  // Company
  await setDoc(doc(db, 'companies', 'default'), {
    name: 'TechSolutions Pakistan',
    address: '123 I.I Chundrigar Road, Karachi',
    ntn: '1234567-8',
    strn: '32778761123',
    phone: '+92 300 1234567',
    email: 'sales@techsolutions.pk',
    website: 'www.techsolutions.pk',
    bankDetails: 'Bank Al Habib, Acc: 1234-5678-9012'
  });

  // Customers
  const cust1 = await addDoc(collection(db, 'customers'), {
    name: 'Ali Enterprises',
    customerId: 'CUST-001',
    ntn: '7654321-0',
    strn: '03001234567',
    phone: '0300-1112233',
    email: 'ali@enterprises.com',
    address: '45 Shahrah-e-Faisal',
    city: 'Karachi'
  });

  const cust2 = await addDoc(collection(db, 'customers'), {
    name: 'Zaman Logistics',
    customerId: 'CUST-002',
    ntn: '8877665-1',
    strn: '04009876543',
    phone: '0333-4445566',
    email: 'contact@zaman.pk',
    address: '12 Gulberg III',
    city: 'Lahore'
  });

  // Products
  await addDoc(collection(db, 'products'), {
    code: 'PROD-001',
    name: 'Dell XPS 15',
    category: 'Electronics',
    unit: 'pcs',
    purchasePrice: 250000,
    salePrice: 300000,
    taxPercentage: 18,
    currentStock: 45,
    minimumStock: 10
  });

  await addDoc(collection(db, 'products'), {
    code: 'PROD-002',
    name: 'Logitech MX Master 3',
    category: 'Accessories',
    unit: 'pcs',
    purchasePrice: 15000,
    salePrice: 22000,
    taxPercentage: 18,
    currentStock: 120,
    minimumStock: 20
  });

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);
