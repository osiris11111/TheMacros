import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider, messaging } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, onSnapshot, doc, setDoc, updateDoc, getDoc, deleteDoc, orderBy, limit, arrayUnion } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import { CartItem, MenuItem, MenuCategory, OperationType } from './types';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { showToast, handleFirestoreError } from './lib/utils';
import Admin from './components/Admin';
import Packages from './components/Packages';
import Checkout from './components/Checkout';
import Profile from './components/Profile';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  state = { hasError: false, error: null };

  constructor(props: { children: React.ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface p-6">
          <div className="bg-surface-container-low p-8 rounded-2xl max-w-md w-full text-center">
            <span className="material-symbols-outlined text-6xl text-error mb-4">error</span>
            <h1 className="font-headline text-2xl mb-4">Something went wrong</h1>
            <p className="text-on-surface-variant mb-6">We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.</p>
            <button onClick={() => window.location.reload()} className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold">
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// --- Components ---

export function CachedImage({ src, alt, className, referrerPolicy, loading, ...props }: any) {
  // Use standard img tag, rely on native browser caching caching.
  // We allow passing `loading="lazy"` explicitly if needed, otherwise it defaults to eager.
  return <img src={src || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'} alt={alt} className={className} referrerPolicy={referrerPolicy} loading={loading || 'lazy'} {...props} />;
}

function BottomNav() {
  const location = useLocation();
  const currentView = location.pathname === '/' ? 'home' : location.pathname.substring(1);

  return (
    <nav className="fixed bottom-0 w-full bg-surface border-t border-outline-variant/20 z-50 pb-safe">
      <div className="flex justify-around items-center h-16">
        <Link to="/" className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'home' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl">view_compact_alt</span>
          <span className="text-[10px] font-medium mt-1">Macros</span>
        </Link>
        <Link to="/menu" className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'menu' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl">local_dining</span>
          <span className="text-[10px] font-medium mt-1">Menu</span>
        </Link>
        <Link to="/packages" className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'packages' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl">inventory_2</span>
          <span className="text-[10px] font-medium mt-1">Packages</span>
        </Link>
        <Link to="/checkout" className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'checkout' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl">shopping_bag</span>
          <span className="text-[10px] font-medium mt-1">Cart</span>
        </Link>
        <Link to="/profile" className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'profile' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl">receipt_long</span>
          <span className="text-[10px] font-medium mt-1">Orders</span>
        </Link>
        </div>
    </nav>
  );
}

function TopBar() {
  const location = useLocation();
  const currentView = location.pathname === '/' ? 'home' : location.pathname.substring(1);
  const isHome = currentView === 'home';
  return (
    <header className="absolute top-0 w-full bg-transparent z-40 pt-2 flex items-center justify-center pointer-events-none">
      <Link to="/" className="pointer-events-auto">
        <CachedImage 
          loading="eager"
          src="https://res.cloudinary.com/dapr6bwus/image/upload/f_auto,q_auto/v1782313348/macroslogo_zcrssn.png" 
          alt="Precision Nutrition Logo" 
          className={`${isHome ? 'w-[226px] h-[175px] mt-[9px] mb-[-5px]' : 'w-[140px] h-[100px] mt-[0px]'} object-contain drop-shadow-2xl transition-all duration-300`} 
        />
      </Link>
    </header>
  );
}

function Home({ setView }: { setView: (view: string) => void }) {
  return (
    <main>
      <section className="relative min-h-screen flex flex-col items-center justify-start px-6 overflow-hidden pt-[240px] md:pt-[270px] lg:pt-[220px] pb-24">
        <div className="absolute inset-0 z-0 bg-surface-container">
          <CachedImage loading="eager" alt="Background Mobile" className="block md:hidden w-full h-full object-cover object-center opacity-90" src="https://res.cloudinary.com/dapr6bwus/image/upload/f_auto,q_auto/v1782162101/backg_tarucf.png" />
          <CachedImage loading="eager" alt="Background Desktop" className="hidden md:block w-full h-full object-cover object-center opacity-90" src="https://res.cloudinary.com/dapr6bwus/image/upload/f_auto,q_auto/v1782162142/background_jwlopw.png" />
        </div>
        <div className="relative z-10 w-full max-w-4xl mx-auto text-center flex flex-col items-center mt-12 md:mt-16 mb-16">
          
          <h1 className="font-headline text-5xl md:text-7xl text-on-surface leading-[1.1] mb-6 font-normal">Precision<br/><span className="font-normal text-primary">Nutrition.</span></h1>
          <div className="flex flex-col gap-4 w-full max-w-sm md:max-w-none md:w-fit">
            <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
              <button onClick={() => setView('menu')} className="bg-primary text-on-primary px-10 py-4 rounded-lg font-['Arial'] font-bold uppercase tracking-widest text-sm hover:bg-primary-container transition-colors w-full">Order Here</button>
              <a href="https://wa.me/96171668644?text=Hello%2C%20Can%20I%20please%20order." target="_blank" rel="noopener noreferrer" className="bg-primary text-on-primary px-10 py-4 rounded-lg font-['Arial'] font-bold uppercase tracking-widest text-sm hover:bg-primary-container transition-colors w-full flex items-center justify-center gap-2 whitespace-nowrap">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Contact Us
              </a>
            </div>
            <button onClick={() => setView('packages')} className="bg-primary text-on-primary px-6 py-4 rounded-lg font-['Arial'] font-bold uppercase tracking-widest text-sm hover:bg-primary-container transition-colors w-full flex items-center justify-center">
              Save Up to 30%
            </button>
          </div>
        </div>
        
      </section>
    </main>
  );
}

function MenuCardItem({ item, idx, favorites, toggleFavorite, onSelect, menuItemsList }: any) {
  const [selectedSize, setSelectedSize] = React.useState<string | null>(
    (item.sizes && item.sizes.length > 0 && (item.showOptionsOnCard || item.sizes.length === 1)) ? item.sizes[0].label : null
  );

  const displayPrice = selectedSize 
    ? item.sizes.find((s: any) => s.label === selectedSize)?.price || item.price
    : item.price;

  return (
    <div 
      className={`flex gap-4 bg-surface-container-low p-4 rounded-xl transition relative ${item.available === false || item.outOfStock ? 'opacity-60 grayscale-[50%]' : 'cursor-pointer hover:bg-surface-container-high'}`} 
      onClick={() => {
        if (item.available !== false) {
          onSelect(item, selectedSize);
        }
      }}
    >
      <CachedImage loading={item.category?.toLowerCase() === 'combos' || item.categories?.includes('COMBOS') || item.categories?.includes('combos') ? 'eager' : 'lazy'} src={item.img} alt={item.title} className="w-24 h-24 object-cover rounded-lg" />
      <div className="flex flex-col flex-1">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg text-on-surface">{item.title}</h3>
          <button 
            onClick={(e) => toggleFavorite(e, item.id)} 
            className={`p-1 rounded-full transition-colors ${favorites.includes(item.id) ? 'text-error' : 'text-on-surface-variant hover:text-error'}`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: favorites.includes(item.id) ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
          </button>
        </div>
        <p className="text-on-surface-variant text-xs line-clamp-2 mt-1 mb-2">{item.desc}</p>
        
        {(item.sizes && item.sizes.length > 0 && (item.showOptionsOnCard || item.sizes.length === 1)) && (
          <div className="flex flex-wrap gap-2 mb-2" onClick={e => e.stopPropagation()}>
            {item.sizes.map((size: any) => (
              <button 
                key={size.label}
                onClick={(e) => { e.stopPropagation(); setSelectedSize(size.label); }}
                className={`text-[10px] font-bold px-2 py-1 rounded border ${selectedSize === size.label ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-highest'}`}
              >
                {size.label}
              </button>
            ))}
          </div>
        )}

        <span className="font-label text-primary font-bold mt-auto">${displayPrice.replace('$', '')}</span>
      </div>
      {item.available === false && !item.outOfStock && (
        <div className="absolute top-2 right-2 bg-error text-on-error px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded shadow-sm">
          Unavailable
        </div>
      )}
      {item.outOfStock && (
        <div className="absolute top-2 right-2 bg-error text-on-error px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded shadow-sm">
          Out of Stock
        </div>
      )}
    </div>
  );
}

function Menu({ setView, cartItems, setCartItems, isAdmin, isBagOpen, setIsBagOpen, menuItemsList, categoriesList, user, favorites, isLoading, retryFetch }: { setView: (v: string) => void, cartItems: CartItem[], setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>, isAdmin: boolean, isBagOpen: boolean, setIsBagOpen: (v: boolean) => void, menuItemsList: MenuItem[], categoriesList: MenuCategory[], user: User | null, favorites: string[], isLoading?: boolean, retryFetch?: () => void }) {
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<string | null>(null);
  
  // Add-ons state
  const [quantity, setQuantity] = useState<number>(1);
  const [friesSelection, setFriesSelection] = useState<'None' | 'Small' | 'Medium' | 'Large'>('None');
  const [softDrinksSelection, setSoftDrinksSelection] = useState<Record<string, number>>({});
  const [sauceSelection, setSauceSelection] = useState<Record<string, number>>({});
  const [sizeSelection, setSizeSelection] = useState<string>('');

  const toggleFavorite = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    if (!user) {
      setPendingFavorite(itemId);
      setShowLoginModal(true);
      return;
    }
    try {
      const userRef = doc(db, 'users', user.uid);
      if (favorites.includes(itemId)) {
        await setDoc(userRef, { favorites: favorites.filter(id => id !== itemId) }, { merge: true });
      } else {
        await setDoc(userRef, { favorites: [...favorites, itemId] }, { merge: true });
      }
    } catch (error) {
      console.error("Error updating favorites", error);
    }
  };

  const menuItems = React.useMemo(() => {
    const validCategoryNames = categoriesList.map(c => c.name);
    const acc: Record<string, MenuItem[]> = {};
    validCategoryNames.forEach(name => acc[name] = []);
    acc['other'] = [];

    menuItemsList.forEach(item => {
      let placed = false;
      const itemCats = [item.category, ...(item.categories || [])].filter(Boolean).map(c => c!.toLowerCase().trim());
      
      validCategoryNames.forEach(validCat => {
        const validCatLower = validCat.toLowerCase().trim();
        // exact match or item category includes valid category (e.g. 'chicken bowl' includes 'chicken')
        if (itemCats.some(ic => ic === validCatLower || ic.includes(validCatLower))) {
          if (!acc[validCat].some(x => x.id === item.id)) {
            acc[validCat].push(item);
            placed = true;
          }
        }
      });

      if (!placed) {
        acc['other'].push(item);
      }
    });
    return acc;
  }, [menuItemsList, categoriesList]);

  useEffect(() => {
    if (categoriesList.length > 0 && !activeCategory) {
      const visibleCats = categoriesList.filter(c => c.name.toLowerCase() !== 'others');
      if (visibleCats.length > 0) {
        setActiveCategory(visibleCats[0].name);
      } else {
        setActiveCategory(categoriesList[0].name);
      }
    }
  }, [categoriesList, activeCategory]);

  const handleAddToOrder = () => {
    if (modalItem) {
      let basePrice = 0;
      let selectedSizeLabel = '';
      
      if (modalItem.sizes && modalItem.sizes.length > 0 && sizeSelection) {
        const sizeObj = modalItem.sizes.find(s => s.label === sizeSelection);
        if (sizeObj) {
          basePrice = parseFloat(sizeObj.price.replace('$', ''));
          selectedSizeLabel = ` (${sizeSelection})`;
        }
      } else {
        basePrice = parseFloat(modalItem.price.replace('$', ''));
      }

      let addonsText = [];
      let addonsList = [];

      if (modalItem.allowFriesAndDrink && friesSelection !== 'None') {
        const friesPrice = friesSelection === 'Small' ? 3 : friesSelection === 'Medium' ? 4 : 5;
        basePrice += friesPrice;
        addonsText.push(`Fries (${friesSelection})`);
        addonsList.push({ id: `fries-${Date.now()}`, title: `Fries (${friesSelection})`, price: friesPrice, type: 'fries' });
      }

      if (modalItem.allowFriesAndDrink) {
        const softDrinks = menuItems['soft drinks'] || [];
        Object.entries(softDrinksSelection).forEach(([drinkId, qtyValue]) => {
          const qty = Number(qtyValue);
          if (qty > 0) {
            const drink = softDrinks.find(d => d.id === drinkId);
            if (drink) {
              const drinkPrice = parseFloat(drink.price.replace('$', '')) * qty;
              basePrice += drinkPrice;
              addonsText.push(`${qty}x ${drink.title}`);
              addonsList.push({ id: `drink-${drinkId}-${Date.now()}`, title: `${qty}x ${drink.title}`, price: drinkPrice, type: 'drink', drinkId, qty });
            }
          }
        });
      }

      if (modalItem.allowSauces && modalItem.sauces) {
        Object.entries(sauceSelection).forEach(([sauceName, qtyValue]) => {
          const qty = Number(qtyValue);
          if (qty > 0) {
            addonsText.push(`${qty}x ${sauceName}`);
            addonsList.push({ id: `sauce-${sauceName}-${Date.now()}`, title: `${qty}x ${sauceName}`, price: 0, type: 'sauce', qty });
          }
        });
      }

      const customizations = `${addonsText.length > 0 ? `Add-ons: ${addonsText.join(', ')}` : ''}${specialInstructions ? ` | Notes: ${specialInstructions}` : ''}`;
      
      setCartItems([...cartItems, { 
        id: Date.now() + Math.random(), 
        title: modalItem.title + selectedSizeLabel, 
        price: `$${basePrice.toFixed(2)}`, 
        qty: quantity, 
        img: modalItem.img, 
        customizations,
        addons: addonsList,
        basePrice,
        specialInstructions
      }]);
      
      setModalItem(null);
      setModalStep(1);
      setSpecialInstructions('');
      setFriesSelection('None');
      setSoftDrinksSelection({});
      setSauceSelection({});
      setSizeSelection('');
      setQuantity(1);
      setIsBagOpen(true);
    }
  };

  const removeAddon = (itemId: number, addonId: string) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === itemId && item.addons) {
        const newAddons = item.addons.filter(a => a.id !== addonId);
        const newPrice = (item.basePrice || 0) + newAddons.reduce((sum, a) => sum + a.price, 0);
        
        let addonsText = newAddons.map(a => a.title);
        const customizations = `${addonsText.length > 0 ? `Add-ons: ${addonsText.join(', ')}` : ''}${item.specialInstructions ? ` | Notes: ${item.specialInstructions}` : ''}`;
        
        return { ...item, addons: newAddons, price: `$${newPrice.toFixed(2)}`, customizations };
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => total + (parseFloat(item.price.replace('$', '')) * item.qty), 0).toFixed(2);
  };

  const softDrinks = menuItems['soft drinks'] || [];

  return (
    <main className="pt-36 pb-32 px-6 max-w-5xl mx-auto relative min-h-screen">
      <div className="fixed inset-0 z-0 pointer-events-none w-full h-full">
         <CachedImage src="https://res.cloudinary.com/dapr6bwus/image/upload/f_auto,q_auto/v1782304614/IMG_2713_douiic.jpg" alt="Menu Background" loading="eager" className="w-full h-full object-cover opacity-40" />
      </div>
      <div className="relative w-full h-full">
      <h1 className="font-headline text-4xl text-primary font-bold mb-6">Menu</h1>
      
      <div className="flex gap-3 overflow-x-auto mb-8 pb-4 custom-scrollbar snap-x snap-mandatory -mx-6 px-6 md:mx-0 md:px-0 scroll-smooth">
        {isLoading && categoriesList.length === 0 ? (
           Array.from({ length: 4 }).map((_, i) => (
             <div key={`cat-skel-${i}`} className="shrink-0 snap-start px-6 py-4 rounded-full bg-surface-container-high animate-pulse w-24"></div>
           ))
        ) : categoriesList.filter(c => c.name.toLowerCase() !== 'others').map(category => (
          <button 
            key={category.id} 
            onClick={() => setActiveCategory(category.name)}
            className={`shrink-0 snap-start px-6 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${activeCategory === category.name ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
               <div key={`skel-${i}`} className="flex gap-4 bg-surface-container-low p-4 rounded-xl animate-pulse">
                 <div className="w-24 h-24 rounded-lg bg-surface-container-highest shrink-0"></div>
                 <div className="flex flex-col flex-1 gap-2">
                   <div className="h-4 bg-surface-container-highest rounded w-3/4"></div>
                   <div className="h-3 bg-surface-container-highest rounded w-full mt-1"></div>
                   <div className="h-3 bg-surface-container-highest rounded w-5/6"></div>
                   <div className="mt-auto h-4 w-1/4 bg-surface-container-highest rounded"></div>
                 </div>
               </div>
            ))}
          </div>
        </section>
      ) : activeCategory && menuItems[activeCategory] && (
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {menuItems[activeCategory].map((item, idx) => (
              <MenuCardItem 
                key={item.id || idx} 
                item={item} 
                idx={idx} 
                favorites={favorites} 
                toggleFavorite={toggleFavorite}
                menuItemsList={menuItemsList} 
                onSelect={(selectedItem: any, predefinedSize: string | null) => {
                  setModalItem(selectedItem);
                  setModalStep(1);
                  setFriesSelection('None');
                  setSoftDrinksSelection({});
                  if (predefinedSize) setSizeSelection(predefinedSize);
                  else if (selectedItem.sizes && selectedItem.sizes.length === 1) setSizeSelection(selectedItem.sizes[0].label);
                  else setSizeSelection('');
                }}
              />
            ))}
          </div>
        </section>
      )}
      {!isLoading && (!activeCategory || !menuItems[activeCategory] || menuItems[activeCategory].length === 0) && (
        <div className="flex flex-col items-center">
          <p className="text-on-surface-variant text-center">No items available in this category.</p>
          {retryFetch && (
            <button 
              onClick={retryFetch}
              className="bg-primary text-on-primary px-6 py-2 rounded-full font-bold text-sm mt-4 transition-colors hover:bg-primary/90"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {modalItem && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModalItem(null)}>
            <div className="bg-surface w-full md:max-w-md rounded-t-3xl md:rounded-2xl overflow-hidden shadow-2xl relative max-h-[85dvh] flex flex-col" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 z-[50] bg-black/50 text-white rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-md" onClick={() => setModalItem(null)}>
                    <span className="material-symbols-outlined">close</span>
                </button>
                <div className="overflow-y-auto pb-24">
                    {modalStep === 1 ? (
                      <>
                        <CachedImage src={modalItem.img} alt={modalItem.title} className="w-full h-64 object-cover" />
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-2">
                                <h2 className="font-bold text-2xl text-primary">{modalItem.title}</h2>
                                <span className="text-xl font-bold text-secondary">{modalItem.price}</span>
                            </div>
                            <p className="text-on-surface-variant text-sm mb-6">{modalItem.desc}</p>
                            
                            <div className="bg-surface-container-low rounded-xl p-4 mb-6 space-y-3 text-sm">
                                <div className="flex justify-between pb-2">
                                    <span className="font-bold text-on-surface">Prep Time</span>
                                    <span className="text-on-surface-variant">
                                      {modalItem.category === 'PACKAGES' || modalItem.categories?.includes('PACKAGES') ? (modalItem.prepTime || '15 mins') : '(≈ 45 mins)'}
                                    </span>
                                </div>
                            </div>

                            {modalItem.sizes && modalItem.sizes.length > 0 && (
                              <div className="mb-6">
                                {modalItem.sizes.length > 1 && (
                                  <>
                                    <label className="block text-sm font-bold mb-2">Select Size</label>
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                      {modalItem.sizes.map((size: any) => (
                                        <button 
                                          key={size.label}
                                          onClick={() => setSizeSelection(size.label)}
                                          className={`p-3 rounded-xl border text-left flex justify-between items-center ${sizeSelection === size.label ? 'border-primary bg-primary/10' : 'border-outline-variant/30 bg-surface-container-low'}`}
                                        >
                                          <span className="font-bold text-sm">{size.label}</span>
                                          <span className="text-xs text-on-surface-variant">{size.price}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                                {sizeSelection && (() => {
                                  const selectedSizeObj = modalItem.sizes.find(s => s.label === sizeSelection);
                                  if (selectedSizeObj && (selectedSizeObj.protein || selectedSizeObj.carbs || selectedSizeObj.fats || (modalItem.sizes.length === 1 && selectedSizeObj.label))) {
                                    return (
                                      <div className="mt-3 p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low flex justify-center items-center text-sm font-medium text-on-surface-variant flex-wrap gap-2">
                                        {modalItem.sizes.length === 1 && selectedSizeObj.label && (
                                          <span className="font-bold text-on-surface whitespace-nowrap">{selectedSizeObj.label}</span>
                                        )}
                                        {modalItem.sizes.length === 1 && selectedSizeObj.label && (selectedSizeObj.protein || selectedSizeObj.carbs || selectedSizeObj.fats) && (
                                          <span className="opacity-50 font-bold">•</span>
                                        )}
                                        {selectedSizeObj.protein && <span className="font-bold whitespace-nowrap">Pro: {selectedSizeObj.protein}g</span>}
                                        {selectedSizeObj.protein && (selectedSizeObj.carbs || selectedSizeObj.fats) && <span className="opacity-50 font-bold">•</span>}
                                        {selectedSizeObj.carbs && <span className="font-bold whitespace-nowrap">Carbs: {selectedSizeObj.carbs}g</span>}
                                        {selectedSizeObj.carbs && selectedSizeObj.fats && <span className="opacity-50 font-bold">•</span>}
                                        {selectedSizeObj.fats && <span className="font-bold whitespace-nowrap">Fat: {selectedSizeObj.fats}g</span>}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}

                            <div className="mb-6">
                                <label className="block text-sm font-bold mb-2">Special Instructions & Toppings</label>
                                <textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} placeholder="e.g., No onions, extra cheese..." rows={2} className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30 text-sm"></textarea>
                            </div>

                            <div className="mb-6 flex items-center justify-between bg-surface-container-low p-3 rounded-xl border border-outline-variant/30">
                              <span className="font-bold text-sm">Quantity</span>
                              <div className="flex items-center gap-4">
                                <button
                                  onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                                  className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-bold"
                                >-</button>
                                <span className="font-bold text-base w-4 text-center">{quantity}</span>
                                <button
                                  onClick={() => setQuantity(prev => prev + 1)}
                                  className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold"
                                >+</button>
                              </div>
                            </div>

                            <button 
                              onClick={() => {
                                if (modalItem.outOfStock) return;
                                if (modalItem.sizes && modalItem.sizes.length > 0 && !sizeSelection) {
                                  alert('Please select a size');
                                  return;
                                }
                                if (modalItem.allowFriesAndDrink || modalItem.allowSauces) {
                                  setModalStep(2);
                                } else {
                                  handleAddToOrder();
                                }
                              }} 
                              disabled={modalItem.outOfStock}
                              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 ${modalItem.outOfStock ? 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed opacity-50' : 'bg-primary text-on-primary'}`}
                            >
                                {modalItem.outOfStock ? 'Out of Stock' : (modalItem.allowFriesAndDrink || modalItem.allowSauces) ? 
                                  <>Next: Add-ons <span className="material-symbols-outlined">arrow_forward</span></> : 
                                  <>Add to Order <span className="material-symbols-outlined">add_shopping_cart</span></>}
                            </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-6 pt-12">
                        <h2 className="font-headline text-2xl text-primary mb-6">Complete Your Meal</h2>
                        
                        {modalItem.allowFriesAndDrink && (
                          <>
                            <div className="mb-8">
                              <h3 className="font-bold text-lg mb-4">Add Fries</h3>
                              <div className="grid grid-cols-2 gap-3">
                                {['None', 'Small', 'Medium', 'Large'].map((size) => {
                                  const price = size === 'Small' ? '+$3' : size === 'Medium' ? '+$4' : size === 'Large' ? '+$5' : '';
                                  return (
                                    <button 
                                      key={size}
                                      onClick={() => setFriesSelection(size as any)}
                                      className={`p-3 rounded-xl border text-left flex justify-between items-center ${friesSelection === size ? 'border-primary bg-primary/10' : 'border-outline-variant/30 bg-surface-container-low'}`}
                                    >
                                      <span className="font-bold text-sm">{size}</span>
                                      <span className="text-xs text-on-surface-variant">{price}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="mb-8">
                              <h3 className="font-bold text-lg mb-4">Add Soft Drinks</h3>
                              <div className="space-y-3">
                                {softDrinks.map(drink => (
                                  <div key={drink.id} className="flex items-center justify-between bg-surface-container-low p-3 rounded-xl border border-outline-variant/30">
                                    <div>
                                      <span className="font-bold text-sm block">{drink.title}</span>
                                      <span className="text-xs text-on-surface-variant">{drink.price}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <button 
                                        onClick={() => setSoftDrinksSelection(prev => ({...prev, [drink.id!]: Math.max(0, (prev[drink.id!] || 0) - 1)}))}
                                        className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-bold"
                                      >-</button>
                                      <span className="w-4 text-center text-sm font-bold">{softDrinksSelection[drink.id!] || 0}</span>
                                      <button 
                                        onClick={() => setSoftDrinksSelection(prev => ({...prev, [drink.id!]: (prev[drink.id!] || 0) + 1}))}
                                        className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold"
                                      >+</button>
                                    </div>
                                  </div>
                                ))}
                                {softDrinks.length === 0 && <p className="text-sm text-on-surface-variant">No soft drinks available.</p>}
                              </div>
                            </div>
                          </>
                        )}

                        {modalItem.allowSauces && modalItem.sauces && modalItem.sauces.length > 0 && (
                          <div className="mb-8">
                            <h3 className="font-bold text-lg mb-4">Add Sauces</h3>
                            <div className="space-y-3">
                              {modalItem.sauces.map(sauce => (
                                <div key={sauce} className="flex items-center justify-between bg-surface-container-low p-3 rounded-xl border border-outline-variant/30">
                                  <div>
                                    <span className="font-bold text-sm block">{sauce}</span>
                                    <span className="text-xs text-on-surface-variant">Free</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button 
                                      onClick={() => setSauceSelection(prev => ({...prev, [sauce]: Math.max(0, (prev[sauce] || 0) - 1)}))}
                                      className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-bold"
                                    >-</button>
                                    <span className="w-4 text-center text-sm font-bold">{sauceSelection[sauce] || 0}</span>
                                    <button 
                                      onClick={() => setSauceSelection(prev => ({...prev, [sauce]: (prev[sauce] || 0) + 1}))}
                                      className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold"
                                    >+</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button onClick={() => setModalStep(1)} className="px-6 py-4 rounded-xl font-bold bg-surface-container-high text-on-surface">Back</button>
                          <button onClick={handleAddToOrder} className="flex-1 bg-primary text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                              <span className="material-symbols-outlined">add_shopping_cart</span> Add to Order
                          </button>
                        </div>
                      </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Sticky Total Summary */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-[90px] md:bottom-16 left-0 right-0 bg-surface border-t border-outline-variant/30 p-4 z-[55] flex justify-between items-center shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.1)]">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Summary</span>
            <span className="text-xl font-headline font-bold text-primary">${calculateTotal()}</span>
          </div>
          <button onClick={() => setIsBagOpen(true)} className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2">
            View Bag ({cartItems.length})
          </button>
        </div>
      )}

      {/* Floating Bag */}
      <div className="fixed bottom-36 right-6 z-[60] hidden">
        {cartItems.length > 0 && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-error text-white text-xs flex items-center justify-center rounded-full font-bold">{cartItems.length}</div>
        )}
        <button onClick={() => setIsBagOpen(true)} className="bg-primary text-on-primary p-4 rounded-full shadow-xl flex items-center justify-center">
            <span className="material-symbols-outlined">shopping_bag</span>
        </button>
      </div>

      {isBagOpen && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setIsBagOpen(false)}>
            <div className="w-full md:max-w-md bg-surface h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-headline font-bold text-primary">Your Bag</h2>
                        {cartItems.length > 0 && (
                            <button onClick={() => setCartItems([])} className="text-xs text-error font-bold tracking-wider uppercase hover:bg-error/10 px-2 py-1 rounded transition-colors">Clear All</button>
                        )}
                    </div>
                    <button onClick={() => setIsBagOpen(false)}><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {cartItems.map(item => (
                        <div key={item.id} className="flex flex-col gap-2 bg-surface-container-low p-3 rounded-lg">
                            <div className="flex gap-4 items-start">
                                <CachedImage src={item.img} className="w-16 h-16 rounded object-cover" />
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm">{item.title} {item.qty > 1 ? `(${item.qty}x)` : ''}</h4>
                                    {item.specialInstructions && <p className="text-xs text-on-surface-variant mt-1 italic">Notes: {item.specialInstructions}</p>}
                                    <span className="text-primary text-sm block mt-1">${(parseFloat((item.price || '').replace('$', '')) * (item.qty || 1)).toFixed(2)}</span>
                                </div>
                                <button onClick={() => setCartItems(cartItems.filter(i => i.id !== item.id))} className="text-error"><span className="material-symbols-outlined">delete</span></button>
                            </div>
                            {item.addons && item.addons.length > 0 && (
                                <div className="mt-2 pl-20 space-y-2">
                                    {item.addons.map(addon => (
                                        <div key={addon.id} className="flex justify-between items-center text-xs bg-surface p-2 rounded border border-outline-variant/20">
                                            <span className="font-medium">{addon.title}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-primary">+${addon.price.toFixed(2)}</span>
                                                <button onClick={() => removeAddon(item.id, addon.id)} className="text-error hover:bg-error/10 rounded-full p-1"><span className="material-symbols-outlined text-[14px]">close</span></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {cartItems.length > 0 && (
                    <div className="p-6 border-t border-outline-variant/20">
                        <div className="flex justify-between font-bold text-lg mb-4"><span>Total</span><span>${calculateTotal()}</span></div>
                        <button onClick={() => { setIsBagOpen(false); setView('checkout'); }} className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold">Checkout</button>
                    </div>
                )}
            </div>
        </div>
      )}
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowLoginModal(false); setPendingFavorite(null); }}>
          <div className="bg-surface rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl relative text-center" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 z-[50] text-on-surface-variant hover:text-on-surface" onClick={() => { setShowLoginModal(false); setPendingFavorite(null); }}>
                <span className="material-symbols-outlined">close</span>
            </button>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
              <span className="material-symbols-outlined text-3xl">favorite</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Save your favorites</h2>
            <p className="text-on-surface-variant text-sm mb-8">Sign in to save this item for later.</p>
            <button 
              onClick={async () => {
                try {
                  const credential = await signInWithPopup(auth, googleProvider);
                  setShowLoginModal(false);
                  
                  const userRef = doc(db, 'users', credential.user.uid);
                  const userSnap = await getDoc(userRef);
                  
                  if (!userSnap.exists()) {
                    await setDoc(userRef, {
                      uid: credential.user.uid,
                      email: credential.user.email,
                      name: credential.user.displayName,
                      role: 'customer',
                      createdAt: new Date().toISOString(),
                      favorites: pendingFavorite ? [pendingFavorite] : []
                    });
                    setPendingFavorite(null);
                  } else if (pendingFavorite) {
                    await setDoc(userRef, { favorites: arrayUnion(pendingFavorite) }, { merge: true });
                    setPendingFavorite(null);
                  }
                } catch (error) {
                  console.error("Login failed", error);
                }
              }} 
              className="bg-primary text-on-primary font-bold py-3 px-6 rounded-xl w-full flex items-center justify-center gap-2"
            >
              Continue with Google
            </button>
          </div>
        </div>
      )}
    </main>
  );
}



function ToastContainer() {
  const [toasts, setToasts] = useState<{ id: number, message: string, type: string }[]>([]);

  useEffect(() => {
    const handleToast = (e: any) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, message: e.detail.message, type: e.detail.type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };
    window.addEventListener('show-toast', handleToast);
    return () => window.removeEventListener('show-toast', handleToast);
  }, []);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-2 rounded shadow-lg text-white text-sm font-medium transition-all ${t.type === 'error' ? 'bg-error' : t.type === 'success' ? 'bg-green-600' : 'bg-gray-800'}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const setView = (v: string) => navigate(v === 'home' ? '/' : `/${v}`);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [isLoadingMenu, setIsLoadingMenu] = useState(() => {
    try {
      return localStorage.getItem('menuItems_cache') ? false : true;
    } catch(e) { return true; }
  });
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    try {
      const cached = localStorage.getItem('menuItems_cache');
      return cached ? JSON.parse(cached) : [];
    } catch(e) { return []; }
  });
  const [categories, setCategories] = useState<MenuCategory[]>(() => {
    try {
      const cached = localStorage.getItem('categories_cache');
      return cached ? JSON.parse(cached) : [];
    } catch(e) { return []; }
  });
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const requestNotificationPermission = async () => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted' && messaging) {
            try {
              const token = await getToken(messaging);
              console.log('FCM Token:', token);
            } catch (e) {
              console.log('FCM getToken failed (expected if vapidKey is missing)', e);
            }
          }
        } catch (error) {
          console.error('Notification permission error:', error);
        }
      }
    };
    requestNotificationPermission();

    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Message received. ', payload);
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(payload.notification?.title || 'Notification', {
              body: payload.notification?.body,
            });
          } catch (e) {
            console.log('Notification API error:', e);
          }
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const fetchMenuAndCategories = React.useCallback(async () => {
      setIsLoadingMenu(true);
      const cachedCats = sessionStorage.getItem('cats_session_cache');
      const cachedItems = sessionStorage.getItem('items_session_cache');

      let currentCats: MenuCategory[] = [];
      let currentItems: MenuItem[] = [];

      try {
          if (cachedCats) {
              currentCats = JSON.parse(cachedCats);
              if (!currentCats.some((c: any) => c.name.toLowerCase() === 'others')) {
                  currentCats.push({ id: 'cat-others', name: 'Others', order: 999 } as any);
              }
              setCategories(currentCats);
          } else {
              const catsSnap = await getDocs(collection(db, 'menuCategories'));
              currentCats = catsSnap.docs.map(d => ({id: d.id, ...d.data()} as MenuCategory)).sort((a, b) => a.order - b.order);
              if (!currentCats.some(c => c.name.toLowerCase() === 'others')) {
                  currentCats.push({ id: 'cat-others', name: 'Others', order: 999 } as any);
              }
              setCategories(currentCats);
              sessionStorage.setItem('cats_session_cache', JSON.stringify(currentCats));
          }

          if (cachedItems) {
              currentItems = JSON.parse(cachedItems);
              setMenuItems(currentItems);
          } else {
              const itemsSnap = await getDocs(collection(db, 'menuItems'));
              let items = itemsSnap.docs.map(d => ({id: d.id, ...d.data()} as MenuItem));
              
              const seen = new Set();
              const legacyTitles = new Set([
                  'the feiesta bowl',
                  'mapu tofu noodles',
                  'the lean kabab wrape',
                  'the tahini shawerma wrap',
                  'the loaded chicken shawerma wrap',
                  'honey garlic salmon',
                  'turkey & cheese sandwich'
              ]);
              items = items.filter(item => {
                  if (!item.title) return false;
                  const titleLower = item.title.toLowerCase().trim();
                  if (legacyTitles.has(titleLower)) return false;
                  if (seen.has(titleLower)) return false;
                  seen.add(titleLower);
                  return true;
              });
              currentItems = items;
              setMenuItems(currentItems);
              sessionStorage.setItem('items_session_cache', JSON.stringify(currentItems));
          }
      } catch(error) {
          handleFirestoreError(error, OperationType.GET, 'menu');
      } finally {
          setIsLoadingMenu(false);
      }
  }, []);

  useEffect(() => {
    fetchMenuAndCategories();

    let unsubUser: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (unsubUser) {
        unsubUser();
        unsubUser = undefined;
      }
      if (u) {
        try {
          const userRef = doc(db, 'users', u.uid);
          const userDoc = await getDoc(userRef);
          if ((userDoc.exists() && userDoc.data().role === 'admin') || u.email === 'apolokor@gmail.com') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
          
          unsubUser = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().favorites) {
              setFavorites(docSnap.data().favorites);
            } else {
              setFavorites([]);
            }
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, 'users');
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'users');
        }
      } else {
        setIsAdmin(false);
        setFavorites([]);
      }
    });
    return () => { unsubAuth(); if (unsubUser) unsubUser(); };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      if (menuItems.length === 0) {
        fetchMenuAndCategories();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchMenuAndCategories, menuItems.length]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-surface text-on-surface">
        <ToastContainer />
        <TopBar />
        
        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<Home setView={setView} />} />
            <Route path="/menu" element={<Menu setView={setView} cartItems={cartItems} setCartItems={setCartItems} isAdmin={isAdmin} isBagOpen={isBagOpen} setIsBagOpen={setIsBagOpen} menuItemsList={menuItems} categoriesList={categories} user={user} favorites={favorites} isLoading={isLoadingMenu} retryFetch={fetchMenuAndCategories} />} />
            <Route path="/packages" element={<Packages setView={setView} cartItems={cartItems} setCartItems={setCartItems} isBagOpen={isBagOpen} setIsBagOpen={setIsBagOpen} menuItemsList={menuItems} isLoading={isLoadingMenu} />} />
            <Route path="/checkout" element={<Checkout setView={setView} cartItems={cartItems} setCartItems={setCartItems} user={user} isBagOpen={isBagOpen} setIsBagOpen={setIsBagOpen} />} />
            <Route path="/profile" element={<Profile user={user} setView={setView} favorites={favorites} menuItemsList={menuItems} setCartItems={setCartItems} />} />
            <Route path="/admin" element={isAdmin ? <Admin user={user} menuItemsList={menuItems} categoriesList={categories} setMenuItems={setMenuItems} setCategories={setCategories} /> : (
              <div className="p-8 text-center mt-32 flex flex-col items-center">
                <h1 className="text-2xl font-bold mb-4">Admin Portal</h1>
                {!user ? (
                  <button onClick={async () => {
                    try {
                      await signInWithPopup(auth, googleProvider);
                    } catch (e) {
                      console.error("Admin login failed", e);
                    }
                  }} className="bg-primary text-on-primary font-bold py-3 px-6 rounded-xl w-full max-w-xs mb-4">
                    Sign In to Continue
                  </button>
                ) : (
                  <p className="mb-4 text-error">Access denied: Your account does not have admin privileges.</p>
                )}
                <button onClick={() => navigate('/')} className="text-primary font-bold">Go Home</button>
              </div>
            )} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <BottomNav />
      </div>
    </ErrorBoundary>
  );
}


export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
