import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, orderBy, limit, where, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import { googleProvider } from '../firebase';
import { MenuItem, MenuCategory, CartItem, OperationType } from '../types';
import { showToast, handleFirestoreError } from '../lib/utils';
import { getToken } from 'firebase/messaging';
import { CachedImage } from '../App';

export default function Checkout({ setView, cartItems, setCartItems, user, isBagOpen, setIsBagOpen }: { setView: (v: string) => void, cartItems: CartItem[], setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>, user: User | null, isBagOpen: boolean, setIsBagOpen: (v: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userInfo, setUserInfo] = useState(() => {
    try {
      const cached = localStorage.getItem('guestCheckoutInfo');
      if (cached) return JSON.parse(cached);
    } catch(e){}
    return { name: '', phone: '', email: '', address: '' };
  });
  const [isEditingInfo, setIsEditingInfo] = useState(() => {
    try {
      const cached = localStorage.getItem('guestCheckoutInfo');
      if (cached) return false;
    } catch(e){}
    return true;
  });
  const [paymentMethod, setPaymentMethod] = useState('pod');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any | null>(null);
  const [promoError, setPromoError] = useState('');

  const applyPromoCode = async () => {
    if (!promoCode) return;
    setPromoError('');
    try {
      const promoDoc = await getDoc(doc(db, 'promos', promoCode.toUpperCase()));
      if (promoDoc.exists()) {
        const promoData = promoDoc.data();
        if (promoData.currentUses >= promoData.maxUsesOverall) {
          setPromoError('This promo code has reached its maximum usage limit.');
          return;
        }
        if (user && promoData.usedBy && promoData.usedBy[user.uid] >= promoData.maxUsesPerUser) {
          setPromoError('You have reached the maximum usage limit for this promo code.');
          return;
        }
        if (promoData.expiryDate && new Date(promoData.expiryDate) < new Date()) {
          setPromoError('This promo code has expired.');
          return;
        }
        setAppliedPromo(promoData);
      } else {
        setPromoError('Invalid promo code.');
      }
    } catch (error) {
      console.error(error);
      setPromoError('Error applying promo code.');
    }
  };

  useEffect(() => {
    if (user) {
      const fetchUserInfo = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          if (docSnap.exists() && docSnap.data().deliveryInfo) {
            const info = docSnap.data().deliveryInfo;
            setUserInfo(info);
            setAddress(info.address || '');
            setIsEditingInfo(false);
          } else {
            setUserInfo(prev => ({ ...prev, email: user.email || '' }));
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchUserInfo();
    }
  }, [user]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (address.length > 3 && isEditingInfo) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5`);
          const data = await res.json();
          setAddressSuggestions(data);
          setShowSuggestions(true);
        } catch (e) {
          console.error("Error fetching address suggestions", e);
        }
      } else {
        setShowSuggestions(false);
      }
    };
    
    const timeoutId = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timeoutId);
  }, [address, isEditingInfo]);

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
    let total = cartItems.reduce((sum, item) => sum + (parseFloat(item.price.replace('$', '')) * item.qty), 0);
    if (appliedPromo) {
      if (appliedPromo.discountType === 'percentage') {
        total = total - (total * (appliedPromo.discountValue / 100));
      } else if (appliedPromo.discountType === 'fixed') {
        total = Math.max(0, total - appliedPromo.discountValue);
      }
    }
    return total.toFixed(2);
  };

  const handleCheckout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }
    
    const formData = new FormData(e.currentTarget);
    const phone = isEditingInfo ? (formData.get('phone') as string) : userInfo.phone;
    
    // Validate phone number
    const phoneRegex = /^[0-9+\s()\-]+$/;
    if (phone && !phoneRegex.test(phone)) {
      showToast("Please enter a valid phone number", "error");
      return;
    }

    setLoading(true);
    
    const itemsWithoutImg = cartItems.map(item => {
      const { img, ...rest } = item;
      return rest;
    });

    const orderData: any = {
      id: `ORD-${Date.now()}`,
      items: itemsWithoutImg,
      total: calculateTotal(),
      status: 'pending',
      cancellable: true,
      deliveryDetails: {
        name: isEditingInfo ? formData.get('name') : userInfo.name,
        phone: isEditingInfo ? formData.get('phone') : userInfo.phone,
        email: isEditingInfo ? formData.get('email') || '' : userInfo.email,
        address: isEditingInfo ? formData.get('address') : userInfo.address,
        locationLink: formData.get('locationLink') || '',
        instructions: formData.get('instructions') || '',
        paymentMethod: formData.get('payment')
      },
      createdAt: new Date().toISOString()
    };
    
    if (user) {
      orderData.userId = user.uid;
      if (isEditingInfo) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            deliveryInfo: {
              name: formData.get('name'),
              phone: formData.get('phone'),
              email: formData.get('email') || '',
              address: formData.get('address')
            }
          });
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      let guestId = localStorage.getItem('guestId');
      if (!guestId) {
        guestId = `GUEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        localStorage.setItem('guestId', guestId);
      }
      orderData.guestId = guestId;
      if (isEditingInfo) {
        try {
          localStorage.setItem('guestCheckoutInfo', JSON.stringify({
            name: formData.get('name'),
            phone: formData.get('phone'),
            email: formData.get('email') || '',
            address: formData.get('address')
          }));
        } catch(e){}
      }
    }

    if (appliedPromo) {
      orderData.promoCode = appliedPromo.code;
      orderData.discountAmount = (cartItems.reduce((sum, item) => sum + (parseFloat(item.price.replace('$', '')) * item.qty), 0) - parseFloat(calculateTotal())).toFixed(2);
    }

    try {
      await setDoc(doc(db, 'orders', orderData.id), orderData);

      setCartItems([]);
      setView('profile'); // Redirect to profile/orders
      
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        if (window.confirm('Would you like to enable notifications to get real-time updates on your order status?')) {
          Notification.requestPermission();
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    }
    setLoading(false);
  };

  return (
    <main className="pt-36 pb-32 px-6 max-w-3xl mx-auto relative min-h-screen">
      <div className="fixed inset-0 z-0 pointer-events-none w-full h-full">
         <CachedImage src="https://res.cloudinary.com/dapr6bwus/image/upload/f_auto,q_auto/v1782304512/cart_dzzxcn.png" alt="Checkout Background" loading="eager" className="w-full h-full object-cover object-[center_60%] md:object-[center_60%] opacity-35" />
      </div>
      <div className="relative w-full h-full flex flex-col min-h-[60vh]">
      <h1 className="font-headline text-3xl font-bold not-italic mb-8">Checkout</h1>
      {cartItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
          <h2 className="text-2xl md:text-3xl font-headline text-on-surface">Your bag is empty. Let's add some fuel.</h2>
          <button onClick={() => setView('menu')} className="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold uppercase tracking-wide transition-colors hover:bg-primary-container">
            Browse Menu
          </button>
        </div>
      ) : (
      <form onSubmit={handleCheckout} className="space-y-8">
        <section className="bg-surface-container-low p-6 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg">Delivery Details</h2>
                {!isEditingInfo && (
                    <button type="button" onClick={() => setIsEditingInfo(true)} className="text-primary text-sm font-bold">Edit</button>
                )}
            </div>
            
            {isEditingInfo ? (
                <>
                    <input name="name" type="text" required placeholder="Full Name *" className="w-full p-3 rounded bg-surface border border-outline-variant/30" defaultValue={userInfo.name} />
                    <input name="phone" type="tel" required placeholder="Phone Number *" className="w-full p-3 rounded bg-surface border border-outline-variant/30" defaultValue={userInfo.phone} />
                    <input name="email" type="email" placeholder="Email (Optional)" className="w-full p-3 rounded bg-surface border border-outline-variant/30" defaultValue={userInfo.email} />
                    
                    <div className="relative">
                      <textarea name="address" value={address} onChange={e => setAddress(e.target.value)} required placeholder="Detailed Address *" className="w-full p-3 rounded bg-surface border border-outline-variant/30" rows={3}></textarea>
                      {showSuggestions && addressSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full bg-surface border border-outline-variant/30 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                          {addressSuggestions.map((sug, idx) => (
                            <button 
                              key={idx}
                              type="button"
                              className="w-full text-left p-3 hover:bg-surface-container-high border-b border-outline-variant/10 last:border-0 text-sm"
                              onClick={() => {
                                setAddress(sug.display_name);
                                setShowSuggestions(false);
                              }}
                            >
                              {sug.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                </>
            ) : (
                <div className="text-sm space-y-1 text-on-surface-variant">
                    <p><span className="font-bold text-on-surface">Name:</span> {userInfo.name}</p>
                    <p><span className="font-bold text-on-surface">Phone:</span> {userInfo.phone}</p>
                    {userInfo.email && <p><span className="font-bold text-on-surface">Email:</span> {userInfo.email}</p>}
                    <p><span className="font-bold text-on-surface">Address:</span> {userInfo.address}</p>
                </div>
            )}
            
            {address && (
              <div className="relative w-full h-64 rounded-xl overflow-hidden mt-4 border border-outline-variant/30">
                <iframe 
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                  className="absolute inset-0"
                ></iframe>
              </div>
            )}

            <input name="locationLink" type="url" placeholder="Google Maps Link (Optional)" className="w-full p-3 rounded bg-surface border border-outline-variant/30" />
            <textarea name="instructions" placeholder="Delivery Instructions (e.g., 'Leave at door', 'Call upon arrival')" className="w-full p-3 rounded bg-surface border border-outline-variant/30" rows={2}></textarea>
        </section>
        
        <section className="bg-surface-container-low p-6 rounded-xl space-y-4">
            <h2 className="font-bold text-lg">Payment</h2>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${paymentMethod === 'pod' ? 'border-primary bg-primary/5' : 'border-outline-variant/30 bg-surface'}`}>
                  <input type="radio" name="payment" value="pod" checked={paymentMethod === 'pod'} onChange={(e) => setPaymentMethod(e.target.value)} /> Pay on Delivery
              </label>
              <label className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${paymentMethod === 'omt' ? 'border-primary bg-primary/5' : 'border-outline-variant/30 bg-surface'}`}>
                  <input type="radio" name="payment" value="omt" checked={paymentMethod === 'omt'} onChange={(e) => setPaymentMethod(e.target.value)} /> Whish
              </label>
            </div>
            
            {paymentMethod === 'omt' && (
              <div className="bg-secondary/10 text-secondary-dark p-4 rounded-xl text-sm leading-relaxed mt-4">
                <p className="font-bold mb-2">Instructions for Whish Payment:</p>
                <p>Please send the total amount to <strong>70 797 174</strong>.</p>
                <p className="mt-1"><strong>Important:</strong> Include your full name or email address in the transfer message so we can identify your payment.</p>
                <p className="mt-2">After completing the transfer, click <strong>Place Order</strong> below. Please allow up to 5 minutes for us to verify the receipt. Once confirmed, we will begin preparing your order immediately!</p>
              </div>
            )}
        </section>

        <section className="bg-surface-container-low p-6 rounded-xl space-y-4">
            <h2 className="font-bold text-lg">Promo Code</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text" 
                placeholder="Enter promo code" 
                value={promoCode} 
                onChange={e => setPromoCode(e.target.value)} 
                className="w-full sm:flex-1 p-3 rounded bg-surface border border-outline-variant/30 uppercase"
                disabled={!!appliedPromo}
              />
              <button 
                type="button" 
                onClick={appliedPromo ? () => { setAppliedPromo(null); setPromoCode(''); } : applyPromoCode}
                className={`px-6 py-3 rounded font-bold text-sm whitespace-nowrap w-full sm:w-auto ${appliedPromo ? 'bg-error text-on-error' : 'bg-secondary text-on-secondary'}`}
              >
                {appliedPromo ? 'Remove' : 'Apply'}
              </button>
            </div>
            {promoError && <p className="text-error text-sm">{promoError}</p>}
            {appliedPromo && (
              <p className="text-green-600 font-bold text-sm">
                Promo applied: {appliedPromo.discountType === 'percentage' ? `${appliedPromo.discountValue}% off` : `$${appliedPromo.discountValue} off`}
              </p>
            )}
        </section>

        <button type="submit" disabled={loading || cartItems.length === 0} className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold disabled:opacity-50">
            {loading ? 'Processing...' : `Place Order ($${calculateTotal()})`}
        </button>
      </form>
      )}

      {/* Floating Bag */}
      <div className="fixed bottom-20 right-6 z-[60]">
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
                        <button onClick={() => setIsBagOpen(false)} className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold">Close Bag</button>
                    </div>
                )}
            </div>
        </div>
      )}
      </div>
    </main>
  );
}