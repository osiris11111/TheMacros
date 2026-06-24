const fs = require('fs');

const appTsx = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = appTsx.split('\n');

const packagesStart = lines.findIndex(line => line.startsWith('function Packages('));
const checkoutStart = lines.findIndex(line => line.startsWith('function Checkout('));
const profileStart = lines.findIndex(line => line.startsWith('function Profile('));
const toastStart = lines.findIndex(line => line.startsWith('function ToastContainer('));

const packagesLines = lines.slice(packagesStart, checkoutStart - 1);
const checkoutLines = lines.slice(checkoutStart, profileStart - 1);
const profileLines = lines.slice(profileStart, toastStart - 2);

const buildContent = (name, lines) => {
    return `import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, orderBy, limit, where, onSnapshot } from 'firebase/firestore';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import { googleProvider } from '../firebase';
import { MenuItem, MenuCategory, CartItem, OperationType } from '../types';
import { showToast, handleFirestoreError } from '../lib/utils';
import { getToken } from 'firebase/messaging';

export default ` + lines.join('\n');
}

fs.writeFileSync('src/components/Packages.tsx', buildContent('Packages', packagesLines));
fs.writeFileSync('src/components/Checkout.tsx', buildContent('Checkout', checkoutLines));
fs.writeFileSync('src/components/Profile.tsx', buildContent('Profile', profileLines));

// Modify App.tsx to remove components and import them
const newAppLines = [
  ...lines.slice(0, packagesStart),
  ...lines.slice(toastStart - 2)
];

let newAppTsx = newAppLines.join('\n');

const lastImportIndex = newAppLines.findLastIndex(line => line.startsWith('import'));
newAppLines.splice(lastImportIndex + 1, 0, 
    "import Packages from './components/Packages';",
    "import Checkout from './components/Checkout';",
    "import Profile from './components/Profile';"
);

newAppTsx = newAppLines.join('\n');

fs.writeFileSync('src/App.tsx', newAppTsx);
console.log('Extraction complete.');
