import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, orderBy, limit, where, onSnapshot } from 'firebase/firestore';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import { googleProvider } from '../firebase';
import { MenuItem, MenuCategory, CartItem, OperationType } from '../types';
import { showToast, handleFirestoreError } from '../lib/utils';
import { getToken } from 'firebase/messaging';
import { CachedImage } from '../App';

export default function Packages({ setView, cartItems, setCartItems, isBagOpen, setIsBagOpen, menuItemsList, isLoading }: any) {
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedProtein, setSelectedProtein] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  const packages = React.useMemo(() => menuItemsList.filter((i: MenuItem) => i.category === 'PACKAGES' || i.categories?.includes('PACKAGES') || i.categories?.includes('packages')), [menuItemsList]);

  const handleAddToOrder = () => {
    if (modalItem) {
      if (!selectedProtein) {
        alert("Please select a protein option before adding to order.");
        return;
      }
      let basePrice = parseFloat(modalItem.price.replace('$', ''));
      let notes = specialInstructions;
      if (selectedProtein) notes = `Protein: ${selectedProtein} | ` + notes;

      setCartItems([...cartItems, { 
        id: Date.now() + Math.random(), 
        title: modalItem.title, 
        price: `$${basePrice.toFixed(2)}`, 
        qty: quantity, 
        img: modalItem.img, 
        customizations: notes ? `Notes: ${notes}` : '',
        basePrice,
        specialInstructions: notes
      }]);
      
      setModalItem(null);
      setSpecialInstructions('');
      setSelectedProtein('');
      setQuantity(1);
      setIsBagOpen(true);
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((total: number, item: any) => total + (parseFloat(item.price.replace('$', '')) * item.qty), 0).toFixed(2);
  };

  return (
    <main className="pt-36 pb-32 px-6 max-w-5xl mx-auto relative min-h-screen">
      <div className="fixed inset-0 z-0 pointer-events-none w-full h-full text-center">
         <CachedImage src="https://res.cloudinary.com/dapr6bwus/image/upload/f_auto,q_auto/v1782304522/package_to2m7l.png" alt="Packages Background" loading="eager" className="w-full h-full object-cover object-center md:object-top opacity-[35%] mx-auto" />
      </div>
      <div className="relative w-full h-full">
      <h1 className="font-headline text-4xl text-primary font-bold mb-6">Packages</h1>
      
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
               <div key={`skel-${i}`} className="flex gap-4 bg-surface-container-low p-4 rounded-xl animate-pulse">
                 <div className="w-24 h-24 rounded-lg bg-surface-container-highest shrink-0"></div>
                 <div className="flex flex-col flex-1 gap-2">
                   <div className="h-4 bg-surface-container-highest rounded w-3/4"></div>
                   <div className="h-3 bg-surface-container-highest rounded w-full mt-1"></div>
                   <div className="h-3 bg-surface-container-highest rounded w-5/6"></div>
                   <div className="mt-auto h-4 w-1/4 bg-surface-container-highest rounded"></div>
                 </div>
               </div>
            ))
          ) : packages.map((item: any, idx: number) => (
            <div key={item.id || idx} className="flex gap-4 bg-surface-container-low p-4 rounded-xl transition relative cursor-pointer hover:bg-surface-container-high" onClick={() => setModalItem(item)}>
              <CachedImage loading="lazy" src={item.img || 'https://via.placeholder.com/150'} alt={item.title} className="w-24 h-24 rounded-lg object-cover shadow-sm bg-surface" />
              <div className="flex flex-col flex-1">
                <h3 className="font-bold text-base text-on-surface leading-tight mb-1">{item.title}</h3>
                <p className="text-xs text-on-surface-variant line-clamp-2 md:line-clamp-3 mb-2 flex-grow min-h-[2.5rem]">{item.desc}</p>
                <div className="mt-auto flex items-baseline gap-2">
                  <span className="font-label text-primary font-bold">${item.price.replace('$', '')}</span>
                  {item.originalPrice && !isNaN(parseFloat(item.originalPrice.replace('$', ''))) && (parseFloat(item.originalPrice.replace('$', '')) > parseFloat(item.price.replace('$', ''))) && (
                    <span className="text-xs text-on-surface-variant line-through">${item.originalPrice.replace('$', '')}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!isLoading && packages.length === 0 && <p className="text-on-surface-variant col-span-2">No packages available.</p>}
        </div>
      </section>

      {modalItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setModalItem(null)}>
            <div className="bg-surface w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={() => setModalItem(null)} className="absolute top-4 right-4 z-[50] w-10 h-10 flex items-center justify-center bg-black/50 text-white rounded-full backdrop-blur-md">
                    <span className="material-symbols-outlined">close</span>
                </button>
                <div className="relative h-56 sm:h-64 shrink-0 bg-surface-container">
                    <CachedImage src={modalItem.img || 'https://via.placeholder.com/300'} alt={modalItem.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent"></div>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-2xl font-headline font-bold text-on-surface capitalize">{modalItem.title}</h2>
                        <div className="flex flex-col items-end">
                            <span className="text-lg font-bold text-primary">${modalItem.price.replace('$', '')}</span>
                            {modalItem.originalPrice && !isNaN(parseFloat(modalItem.originalPrice.replace('$', ''))) && (parseFloat(modalItem.originalPrice.replace('$', '')) > parseFloat(modalItem.price.replace('$', ''))) && (
                              <span className="text-sm text-on-surface-variant line-through">${modalItem.originalPrice.replace('$', '')}</span>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">{modalItem.desc}</p>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-bold mb-2">Protein (Select one)</label>
                      <div className="flex flex-col gap-2">
                        {['All Chicken', 'Mix Beef & Chicken'].map(protein => (
                          <label key={protein} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 cursor-pointer text-on-surface">
                            <input 
                              type="radio" 
                              name="protein"
                              checked={selectedProtein === protein}
                              onChange={() => setSelectedProtein(protein)}
                              className="w-5 h-5 accent-primary"
                            />
                            <span className="font-bold text-sm">{protein}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-bold mb-2">Special Instructions</label>
                        <textarea placeholder="Any special requests? (e.g. no onions)" className="w-full p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm focus:border-primary outline-none focus:ring-1 focus:ring-primary" rows={3} value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)}></textarea>
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

                    <button onClick={handleAddToOrder} className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined">add_shopping_cart</span> Add to Order
                    </button>
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
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex justify-end" onClick={() => setIsBagOpen(false)}>
            <div className="w-full max-w-md bg-surface h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
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
                    {cartItems.map((item: any) => (
                        <div key={item.id} className="flex flex-col gap-2 bg-surface-container-low p-3 rounded-lg">
                            <div className="flex gap-4 items-start">
                                <CachedImage src={item.img} className="w-16 h-16 rounded object-cover" />
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm">{item.title} {item.qty > 1 ? `(${item.qty}x)` : ''}</h4>
                                    {item.specialInstructions && <p className="text-xs text-on-surface-variant mt-1 italic">Notes: {item.specialInstructions}</p>}
                                    <span className="text-primary text-sm block mt-1">${(parseFloat((item.price || '').replace('$', '')) * (item.qty || 1)).toFixed(2)}</span>
                                </div>
                                <button onClick={() => setCartItems(cartItems.filter((i: any) => i.id !== item.id))} className="text-error"><span className="material-symbols-outlined">delete</span></button>
                            </div>
                        </div>
                    ))}
                    {cartItems.length === 0 && (
                        <div className="text-center text-on-surface-variant mt-10">
                            <span className="material-symbols-outlined text-4xl mb-4 opacity-50">shopping_bag</span>
                            <p>Your bag is empty.</p>
                        </div>
                    )}
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
    </main>
  );
}