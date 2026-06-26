import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, orderBy, limit, where, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import { googleProvider } from '../firebase';
import { MenuItem, MenuCategory, CartItem, OperationType } from '../types';
import { showToast, handleFirestoreError } from '../lib/utils';
import { getToken } from 'firebase/messaging';
import { CachedImage } from '../App';

export default function Profile({ user, setView, favorites, menuItemsList, setCartItems }: { user: User | null, setView: (v: string) => void, favorites: string[], menuItemsList: MenuItem[], setCartItems: (items: any[]) => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [previousOrders, setPreviousOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<{id: number, message: string}[]>([]);
  const [reviewOrder, setReviewOrder] = useState<any | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'favorites'>('orders');

  const handleReorder = (order: any) => {
    const newCartItems = order.items.map((item: any) => {
      const match = menuItemsList.find(mi => mi.title === item.title.replace(/ \((Combo|Package)\)/, ''));
      return {
        ...item,
        img: item.img || (match ? match.img : 'https://via.placeholder.com/150'),
        id: Date.now() + Math.random() // Ensure unique ID for cart
      };
    });
    setCartItems(newCartItems);
    setView('checkout');
  };

  const favoriteItems = menuItemsList.filter(item => favorites.includes(item.id));

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'orders'), where('userId', '==', user.uid));
      const unsub = onSnapshot(q, (snap) => {
        const newOrders = snap.docs.map(d => d.data()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setOrders(prev => {
          if (prev.length > 0) {
            newOrders.forEach(newOrder => {
              const oldOrder = prev.find(o => o.id === newOrder.id);
              if (oldOrder && oldOrder.status !== newOrder.status) {
                const msg = `Order ${newOrder.id} is now ${newOrder.status.toUpperCase()}`;
                const notifId = Date.now() + Math.random();
                setNotifications(n => [...n, { id: notifId, message: msg }]);
                
                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification('Order Status Update', { body: msg });
                  } catch (e) {
                    console.log('Notification API error:', e);
                  }
                }

                setTimeout(() => {
                  setNotifications(n => n.filter(notif => notif.id !== notifId));
                }, 5000);
              }
            });
          }
          return newOrders;
        });
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));
      return () => unsub();
    } else {
      const guestId = localStorage.getItem('guestId');
      const guestOrdersStr = localStorage.getItem('guestOrders');
      const guestOrders = guestOrdersStr ? JSON.parse(guestOrdersStr) : [];
      
      if (guestId && guestOrders.length > 0) {
        const unsubs = guestOrders.map((orderId: string) => {
          return onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
            if (docSnap.exists() && docSnap.data().guestId === guestId) {
              const updatedOrder = docSnap.data();
              
              setOrders(prev => {
                const existing = prev.find(o => o.id === updatedOrder.id);
                const newOrders = prev.filter(o => o.id !== updatedOrder.id);
                newOrders.push(updatedOrder);
                newOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                
                if (existing && existing.status !== updatedOrder.status) {
                  const msg = `Order ${updatedOrder.id} is now ${updatedOrder.status.toUpperCase()}`;
                  const notifId = Date.now() + Math.random();
                  setNotifications(n => [...n, { id: notifId, message: msg }]);
                  
                  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                    try {
                      new Notification('Order Status Update', { body: msg });
                    } catch (e) {
                      console.log('Notification API error:', e);
                    }
                  }

                  setTimeout(() => {
                    setNotifications(n => n.filter(notif => notif.id !== notifId));
                  }, 5000);
                }
                return newOrders;
              });
            }
          }, (error) => {
             // Ignoring individual not-found errors for guests to avoid UI popups
          });
        });
        return () => unsubs.forEach(unsub => unsub());
      }
    }
  }, [user]);

  const handleSignIn = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      // Ensure user profile exists in Firestore
      const userRef = doc(db, 'users', res.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: res.user.uid,
          email: res.user.email,
          name: res.user.displayName,
          role: 'customer',
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'users');
    }
  };

  const submitReview = async () => {
    if (!reviewOrder) return;
    try {
      const reviewId = `REV-${Date.now()}`;
      
      let guestCheckoutInfo: any = null;
      try { guestCheckoutInfo = JSON.parse(localStorage.getItem('guestCheckoutInfo') || '{}'); } catch(e){}
      
      await setDoc(doc(db, 'reviews', reviewId), {
        id: reviewId,
        userId: user ? user.uid : (localStorage.getItem('guestId') || 'guest'),
        userName: user ? (user.displayName || 'Anonymous') : (guestCheckoutInfo?.name || 'Guest'),
        orderId: reviewOrder.id,
        rating,
        comment,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setReviewOrder(null);
      setComment('');
      setRating(5);
      alert('Review submitted successfully! It will be visible after admin approval.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reviews');
    }
  };

  const confirmCancel = async () => {
    if (cancelOrderId) {
      try {
        await updateDoc(doc(db, 'orders', cancelOrderId), { status: 'cancelled' });
        setCancelOrderId(null);
        alert("Order cancelled successfully!");
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'orders');
      }
    }
  };

  const getStatusProgress = (status: string) => {
    switch (status) {
      case 'pending': return 10;
      case 'preparing': return 40;
      case 'delivering': return 75;
      case 'completed': return 100;
      case 'cancelled': return 100;
      default: return 0;
    }
  };

  return (
    <main className="pt-36 pb-32 px-6 max-w-3xl mx-auto relative min-h-screen">
      <div className="fixed inset-0 z-0 pointer-events-none w-full h-full">
         <CachedImage src="https://res.cloudinary.com/dapr6bwus/image/upload/f_auto,q_auto/v1782304565/profile_yphaic.png" alt="Profile Background" loading="eager" className="w-full h-full object-cover md:object-[center_30%] opacity-35" />
      </div>
      <div className="relative w-full h-full">
      {notifications.length > 0 && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-md px-4 pointer-events-none">
          {notifications.map(n => (
            <div key={n.id} className="bg-primary text-on-primary p-4 rounded-xl shadow-xl font-bold text-center animate-bounce">
              {n.message}
            </div>
          ))}
        </div>
      )}

      {user ? (
        <div className="flex items-start md:items-center justify-between mb-8 bg-surface-container-low p-4 sm:p-6 rounded-2xl gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 overflow-hidden">
              <CachedImage src={user.photoURL || ''} alt={user.displayName || 'User'} className="w-12 h-12 sm:w-16 sm:h-16 rounded-full shrink-0" />
              <div className="min-w-0 overflow-hidden">
                  <h1 className="font-headline text-lg sm:text-2xl truncate">{user.displayName}</h1>
                  <p className="text-sm text-on-surface-variant truncate">{user.email}</p>
              </div>
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied' && (
                <button onClick={() => Notification.requestPermission()} className="text-primary text-sm font-bold">Enable Notifications</button>
              )}
              <button onClick={() => signOut(auth)} className="text-error flex items-center justify-center p-2 hover:bg-error/10 rounded-full transition-colors" title="Sign Out">
                 <span className="material-symbols-outlined">logout</span>
              </button>
          </div>
        </div>
      ) : (
        <div className="mb-8 bg-surface-container-low p-6 rounded-2xl text-center">
          <span className="material-symbols-outlined text-4xl text-primary mb-2">account_circle</span>
          <h2 className="font-headline text-xl mb-2">You are checking out as a guest</h2>
          <p className="text-on-surface-variant text-sm mb-4">Sign in to save your details and track your orders easily.</p>
          <button onClick={handleSignIn} className="bg-primary text-on-primary px-6 py-2 rounded-full font-bold text-sm mx-auto">
            Sign in with Google
          </button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto mb-8 pb-2 scrollbar-hide">
        <button 
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-2 rounded-full font-label font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'orders' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}
        >
          Order History
        </button>
        {user && (
          <button 
            onClick={() => setActiveTab('favorites')}
            className={`px-6 py-2 rounded-full font-label font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'favorites' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}
          >
            Favorites
          </button>
        )}
      </div>

      {activeTab === 'favorites' && user && (
        <div className="mb-12">
          {favoriteItems.length === 0 ? (
            <p className="text-on-surface-variant">No favorites found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favoriteItems.map(item => (
                <div key={item.id} className="flex gap-4 bg-surface-container-low p-4 rounded-xl items-center cursor-pointer hover:bg-surface-container-high transition" onClick={() => setView('menu')}>
                  <CachedImage src={item.img} alt={item.title} className="w-16 h-16 object-cover rounded-lg" />
                  <div className="flex flex-col flex-1">
                    <h3 className="font-bold text-base text-on-surface">{item.title}</h3>
                    <span className="font-label text-primary font-bold">${item.price.replace('$', '')}</span>
                  </div>
                  <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className={`mb-12 ${orders.length === 0 ? 'flex flex-col items-center justify-center min-h-[40vh] text-center space-y-6' : ''}`}>
          {orders.length === 0 ? (
            <>
              <h2 className="text-2xl md:text-3xl font-headline text-on-surface">No past orders yet. Time to hit your macros.</h2>
              <button onClick={() => setView('menu')} className="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold uppercase tracking-wide transition-colors hover:bg-primary-container">
                Order Now
              </button>
            </>
          ) : (
            <div className="space-y-6">
                {orders.map(order => (
                    <div key={order.id} className="bg-surface-container-low p-5 rounded-xl">
                    <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-sm">{order.id}</span>
                        <span className={`text-xs px-2 py-1 rounded uppercase font-bold ${order.status === 'cancelled' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>{order.status}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mb-4">{new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}</p>
                    
                    {/* Real-time Status Tracker */}
                    {order.status !== 'cancelled' && (
                        <div className="mb-6">
                            <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">
                                <span className={getStatusProgress(order.status) >= 10 ? 'text-primary' : ''}>Pending</span>
                                <span className={getStatusProgress(order.status) >= 40 ? 'text-primary' : ''}>Preparing</span>
                                <span className={getStatusProgress(order.status) >= 75 ? 'text-primary' : ''}>Delivering</span>
                                <span className={getStatusProgress(order.status) >= 100 ? 'text-primary' : ''}>Completed</span>
                            </div>
                            <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                                <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${getStatusProgress(order.status)}%` }}></div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 mb-4">
                        {order.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex flex-col text-sm">
                                <div className="flex justify-between">
                                    <span className="font-bold">{item.qty}x {item.title}</span>
                                    <span>{item.price != null ? `$${(parseFloat(item.price.replace('$', '')) * Number(item.qty)).toFixed(2)}` : ''}</span>
                                </div>
                                {item.addons && item.addons.length > 0 && (
                                    <div className="pl-4 mt-1 text-xs text-on-surface-variant space-y-1">
                                        {item.addons.map((addon: any) => (
                                            <div key={addon.id} className="flex justify-between">
                                                <span>+ {addon.title} {addon.qty ? `(x${addon.qty})` : ''}</span>
                                                <span>+${addon.price.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {item.specialInstructions && (
                                    <div className="pl-4 mt-1 text-xs text-error italic">
                                        Note: {item.specialInstructions}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center font-bold border-t border-outline-variant/20 pt-4">
                        <span>Total: ${order.total}</span>
                        <div className="flex gap-4">
                            {(order.status === 'pending' || order.status === 'preparing') && order.cancellable && (
                                <button onClick={() => setCancelOrderId(order.id)} className="text-error text-sm">Cancel Order</button>
                            )}
                            {order.status === 'completed' && (
                                <button onClick={() => handleReorder(order)} className="text-secondary text-sm">Reorder</button>
                            )}
                            {order.status === 'completed' && user && (
                                <button onClick={() => setReviewOrder(order)} className="text-primary text-sm">Leave Review</button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
          )}
        </div>
      )}

      {cancelOrderId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface w-full max-w-sm rounded-2xl p-6 relative">
                <h2 className="font-headline text-2xl mb-4 text-error">Cancel Order</h2>
                <p className="text-on-surface-variant mb-6">Are you sure you want to cancel order {cancelOrderId}? This action cannot be undone.</p>
                <div className="flex gap-4">
                    <button onClick={() => setCancelOrderId(null)} className="flex-1 py-3 rounded-xl font-bold bg-surface-container-high text-on-surface">No, Keep It</button>
                    <button onClick={confirmCancel} className="flex-1 py-3 rounded-xl font-bold bg-error text-on-error">Yes, Cancel</button>
                </div>
            </div>
        </div>
      )}

      {reviewOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface w-full max-w-md rounded-2xl p-6 relative">
                <button className="absolute top-4 right-4 text-on-surface-variant" onClick={() => setReviewOrder(null)}>
                    <span className="material-symbols-outlined">close</span>
                </button>
                <h2 className="font-headline text-2xl mb-4">Review Order</h2>
                <p className="text-sm text-on-surface-variant mb-6">Order ID: {reviewOrder.id}</p>
                
                <div className="mb-4">
                    <label className="block text-sm font-bold mb-2">Rating (1-5)</label>
                    <input type="number" min="1" max="5" value={rating} onChange={e => setRating(Number(e.target.value))} className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30" />
                </div>
                <div className="mb-6">
                    <label className="block text-sm font-bold mb-2">Comment</label>
                    <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30" placeholder="How was your experience?"></textarea>
                </div>
                <button onClick={submitReview} className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold">Submit Review</button>
            </div>
        </div>
      )}
      </div>
    </main>
  );
}