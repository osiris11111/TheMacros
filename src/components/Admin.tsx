import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, orderBy, limit, where, onSnapshot, setDoc } from 'firebase/firestore';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { User } from 'firebase/auth';
import { MenuItem, MenuCategory } from '../types';
import { showToast, handleFirestoreError } from '../lib/utils';
import { OperationType } from '../types';
import { CachedImage } from '../App';

export default function Admin({ user, menuItemsList, categoriesList, setMenuItems, setCategories }: { user: User | null, menuItemsList: MenuItem[], categoriesList: MenuCategory[], setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>, setCategories: React.Dispatch<React.SetStateAction<MenuCategory[]>> }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'packages' | 'categories' | 'reviews' | 'users' | 'promos' | 'analytics'>('orders');
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingItemSizes, setEditingItemSizes] = useState<{label: string, price: string, protein?: string, carbs?: string, fats?: string}[]>([]);
  const [editingItemAllowFries, setEditingItemAllowFries] = useState(false);
  const [editingItemAllowSauces, setEditingItemAllowSauces] = useState(false);
  const [editingItemSauces, setEditingItemSauces] = useState<string[]>([]);
  const [editingItemCategories, setEditingItemCategories] = useState<string[]>([]);
  const [editingItemShowOptions, setEditingItemShowOptions] = useState(false);
  const [editingItemCombos, setEditingItemCombos] = useState<string[]>([]);
  const [price450, setPrice450] = useState('');
  const [price700, setPrice700] = useState('');
  const [macros450, setMacros450] = useState({ protein: '', carbs: '', fats: '' });
  const [macros700, setMacros700] = useState({ protein: '', carbs: '', fats: '' });
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [menuItemSearch, setMenuItemSearch] = useState('');
  const [imageUpload, setImageUpload] = useState<string>('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const handleDeleteOrder = async (orderId: string) => {
    if(window.confirm('Are you sure you want to delete this order?')) {
      try {
        await updateDoc(doc(db, 'orders', orderId), { isDeleted: true });
      } catch(e) {
        console.error("Error deleting order", e);
      }
    }
  };

  const openEditItem = (item: MenuItem | null) => {
    setEditingItem(item);
    setImageUpload('');
    if (item) {
      setEditingItemSizes(item.sizes || []);
      const size450 = item.sizes?.find(s => s.label === '450 Cal');
      const size700 = item.sizes?.find(s => s.label === '700 Cal');
      setPrice450(size450?.price || '');
      setPrice700(size700?.price || '');
      setMacros450({ protein: size450?.protein || '', carbs: size450?.carbs || '', fats: size450?.fats || '' });
      setMacros700({ protein: size700?.protein || '', carbs: size700?.carbs || '', fats: size700?.fats || '' });
      setEditingItemAllowFries(item.allowFriesAndDrink || false);
      setEditingItemAllowSauces(item.allowSauces || false);
      setEditingItemSauces(item.sauces || []);
      setEditingItemCategories(item.categories || (item.category ? [item.category] : []));
      setEditingItemShowOptions(item.showOptionsOnCard || false);
      setEditingItemCombos(item.comboItems || []);
    } else {
      setEditingItemSizes([]);
      setPrice450('');
      setPrice700('');
      setMacros450({ protein: '', carbs: '', fats: '' });
      setMacros700({ protein: '', carbs: '', fats: '' });
      setEditingItemAllowFries(false);
      setEditingItemAllowSauces(false);
      setEditingItemSauces([]);
      setEditingItemCategories([]);
      setEditingItemShowOptions(false);
      setEditingItemCombos([]);
    }
  };

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    let unsubActiveOrders: (() => void) | undefined;
    
    const fetchAdminData = async () => {
        try {
            const usersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
            const usersSnap = await getDocs(usersQ);
            if (!isMounted) return;
            setUsers(usersSnap.docs.map(d => d.data()));

            const ordersQ = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50));
            const ordersSnap = await getDocs(ordersQ);
            if (!isMounted) return;
            setOrders(ordersSnap.docs.map(d => d.data()));

            const activeOrdersQ = query(collection(db, 'orders'), where('status', 'in', ['pending', 'preparing', 'delivering']));
            if (!isMounted) return;
            unsubActiveOrders = onSnapshot(activeOrdersQ, (snap) => {
                setOrders(prevOrders => {
                    const newOrders = [...prevOrders];
                    let changed = false;
                    snap.docs.forEach(doc => {
                        const data = doc.data();
                        const index = newOrders.findIndex(o => o.id === data.id);
                        if (index !== -1) {
                            if (JSON.stringify(newOrders[index]) !== JSON.stringify(data)) {
                                newOrders[index] = data;
                                changed = true;
                            }
                        } else {
                            newOrders.unshift(data);
                            changed = true;
                        }
                    });
                    return changed ? newOrders : prevOrders;
                });
            }, (error) => console.error("Active orders listener error:", error));

            const reviewsQ = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(50));
            const reviewsSnap = await getDocs(reviewsQ);
            if (!isMounted) return;
            setReviews(reviewsSnap.docs.map(d => d.data()));
            
            const promosSnap = await getDocs(collection(db, 'promos'));
            if (!isMounted) return;
            setPromos(promosSnap.docs.map(d => d.data()));
        } catch(error) {
            console.error("Error fetching admin data:", error);
        }
    }
    fetchAdminData();
    
    return () => {
        isMounted = false;
        if (unsubActiveOrders) unsubActiveOrders();
    };
  }, [user]);

  const handleAddAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newAdminEmail) return;
    try {
      const q = query(collection(db, 'users'), where('email', '==', newAdminEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'users', snap.docs[0].id), { role: 'admin' });
        alert(`Successfully made ${newAdminEmail} an admin.`);
        setNewAdminEmail('');
      } else {
        alert('User not found. They must sign in to the app first before you can make them an admin.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      const newAvailableStatus = item.available === false ? true : false;
      setMenuItems(prev => {
        const newItems = prev.map(i => i.id === item.id ? { ...i, available: newAvailableStatus } : i);
        sessionStorage.setItem('items_session_cache', JSON.stringify(newItems));
        return newItems;
      });
      await updateDoc(doc(db, 'menuItems', item.id!), { available: newAvailableStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'menuItems');
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    }
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId !== destination.droppableId) {
      updateOrderStatus(draggableId, destination.droppableId);
    }
  };

  const updateReviewStatus = async (reviewId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'reviews', reviewId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'reviews');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max_size = 800;
          
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setImageUpload(dataUrl);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const saveMenuItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = editingItem?.id || `ITEM-${Date.now()}`;
    
    // Validate main price
    const priceStr = formData.get('price') as string;
    const priceVal = parseFloat(priceStr.replace(/[^0-9.-]+/g,""));
    if (isNaN(priceVal) || priceVal < 0) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Main price must be a valid positive number.', type: 'error' } }));
      return;
    }

    // Validate original price
    const originalPriceStr = formData.get('originalPrice') as string;
    if (originalPriceStr) {
      const origPriceVal = parseFloat(originalPriceStr.replace(/[^0-9.-]+/g,""));
      if (isNaN(origPriceVal) || origPriceVal < 0) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Compare-at price must be a valid positive number.', type: 'error' } }));
        return;
      }
    }
    
    let finalImg = imageUpload || (formData.get('img') as string) || editingItem?.img || '';
    if (finalImg.length > 800000) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Image is too large. Please upload a smaller image or use a URL.', type: 'error' } }));
      return;
    }

    const itemSizes = editingItemShowOptions 
      ? [
          { label: '450 Cal', price: price450, protein: macros450.protein, carbs: macros450.carbs, fats: macros450.fats },
          { label: '700 Cal', price: price700, protein: macros700.protein, carbs: macros700.carbs, fats: macros700.fats }
        ].filter(s => s.price) 
      : editingItemSizes;

    for (const size of itemSizes) {
      if (size.price) {
        const pVal = parseFloat(size.price.replace(/[^0-9.-]+/g,""));
        if (isNaN(pVal) || pVal < 0) {
           window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Price for size ${size.label} must be a valid positive number.`, type: 'error' } }));
           return;
        }
      }
    }

    const itemData = {
      id,
      title: formData.get('title'),
      category: editingItemCategories.length > 0 ? editingItemCategories[0] : 'other',
      categories: editingItemCategories,
      showOptionsOnCard: editingItemShowOptions,
      price: formData.get('price'),
      originalPrice: formData.get('originalPrice') || '',
      desc: formData.get('desc'),
      comboItems: (editingItemCategories.includes('COMBOS') || editingItemCategories.includes('combos') || editingItem?.category === 'COMBOS') ? editingItemCombos : [],
      img: finalImg,
      prepTime: formData.get('prepTime'),
      ingredients: formData.get('ingredients'),
      available: editingItem?.available !== false,
      sizes: itemSizes,
      allowFriesAndDrink: editingItemAllowFries,
      allowSauces: editingItemAllowSauces,
      sauces: editingItemSauces
    };
    try {
      await setDoc(doc(db, 'menuItems', id), itemData);
      
      // Optimistic local sync
      setMenuItems(prev => {
        const newItems = prev.find(i => i.id === id) 
            ? prev.map(i => i.id === id ? itemData as MenuItem : i) 
            : [...prev, itemData as MenuItem];
        sessionStorage.setItem('items_session_cache', JSON.stringify(newItems));
        return newItems;
      });
      
      setEditingItem(null);
      setImageUpload('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'menuItems');
    }
  };

  const saveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = editingCategory?.id || `CAT-${Date.now()}`;
    const catData = {
      id,
      name: formData.get('name'),
      order: Number(formData.get('order') || categoriesList.length + 1)
    };
    try {
      await setDoc(doc(db, 'menuCategories', id), catData);

      // Optimistic local sync
      setCategories(prev => {
        const newCats = prev.find(c => c.id === id)
            ? prev.map(c => c.id === id ? catData as MenuCategory : c)
            : [...prev, catData as MenuCategory];
        // Keep sorted by order just in case
        newCats.sort((a, b) => a.order - b.order);
        sessionStorage.setItem('cats_session_cache', JSON.stringify(newCats));
        return newCats;
      });

      setEditingCategory(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'menuCategories');
    }
  };

  const deleteMenuItem = async (id: string | undefined) => {
    if (!id) return;
    setItemToDelete(id);
  };

  const confirmDeleteMenuItem = async () => {
    if (itemToDelete) {
      try {
        await deleteDoc(doc(db, 'menuItems', itemToDelete));
        
        // Optimistic local sync
        setMenuItems(prev => {
            const newItems = prev.filter(i => i.id !== itemToDelete);
            sessionStorage.setItem('items_session_cache', JSON.stringify(newItems));
            return newItems;
        });

        setEditingItem(null);
        setItemToDelete(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'menuItems');
      }
    }
  };

  const deleteCategory = async (id: string | undefined) => {
    if (!id) return;
    setCategoryToDelete(id);
  };

  const confirmDeleteCategory = async () => {
    if (categoryToDelete) {
      try {
        const deletedCategory = categoriesList.find(c => c.id === categoryToDelete);
        await deleteDoc(doc(db, 'menuCategories', categoryToDelete));
        
        if (deletedCategory) {
            const categoriesToUpdate = categoriesList.filter(c => c.order > deletedCategory.order);
            for (const cat of categoriesToUpdate) {
                await updateDoc(doc(db, 'menuCategories', cat.id), {
                    order: cat.order - 1
                });
            }
        }
        
        // Optimistic local sync
        setCategories(prev => {
            let newCats = prev.filter(c => c.id !== categoryToDelete);
            if (deletedCategory) {
                // Adjust orders optimistically
                newCats = newCats.map(c => c.order > deletedCategory.order ? { ...c, order: c.order - 1 } : c);
            }
            newCats.sort((a, b) => a.order - b.order);
            sessionStorage.setItem('cats_session_cache', JSON.stringify(newCats));
            return newCats;
        });

        setEditingCategory(null);
        setCategoryToDelete(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'menuCategories');
      }
    }
  };

  const savePromo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = (formData.get('code') as string).toUpperCase();
    
    const discountValue = Number(formData.get('discountValue'));
    if (isNaN(discountValue) || discountValue < 0) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Discount value must be a positive number.', type: 'error' } }));
      return;
    }

    const promoData: any = {
      id: code,
      code,
      discountType: formData.get('discountType'),
      discountValue,
      maxUsesOverall: Number(formData.get('maxUsesOverall')),
      maxUsesPerUser: Number(formData.get('maxUsesPerUser')),
      currentUses: 0,
      usedBy: {}
    };
    
    const expiryDate = formData.get('expiryDate');
    if (expiryDate) {
      promoData.expiryDate = expiryDate;
    }

    try {
      await setDoc(doc(db, 'promos', code), promoData);
      (e.target as HTMLFormElement).reset();
      alert('Promo code added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'promos');
    }
  };

  const deletePromo = async (code: string) => {
    if (window.confirm(`Are you sure you want to delete promo code ${code}?`)) {
      try {
        await deleteDoc(doc(db, 'promos', code));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'promos');
      }
    }
  };

  const exportSalesData = () => {
    if (!exportStartDate || !exportEndDate) {
      alert('Please select both start and end dates.');
      return;
    }
    const start = new Date(exportStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(exportEndDate);
    end.setHours(23, 59, 59, 999);

    const completedOrders = orders.filter(o => 
      o.status === 'completed' && 
      new Date(o.createdAt) >= start && 
      new Date(o.createdAt) <= end
    );

    if (completedOrders.length === 0) {
      alert('No completed orders found in this date range.');
      return;
    }

    const headers = ['Order ID', 'Date', 'Customer Name', 'Total Amount', 'Items'];
    const csvRows = [headers.join(',')];

    completedOrders.forEach(o => {
      const date = new Date(o.createdAt).toLocaleString().replace(/,/g, '');
      const name = o.deliveryDetails?.name?.replace(/,/g, ' ') || 'Unknown';
      const total = o.total;
      const items = o.items.map((i: any) => `${i.qty}x ${i.title}`).join('; ');
      csvRows.push(`${o.id},${date},${name},${total},"${items}"`);
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `sales_export_${exportStartDate}_to_${exportEndDate}.csv`);
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredOrders = orders.filter(o => !o.isDeleted && (o.id.toLowerCase().includes(orderSearch.toLowerCase()) || o.deliveryDetails?.name?.toLowerCase().includes(orderSearch.toLowerCase())));
  const historyOrders = orders.filter(o => o.id.toLowerCase().includes(orderSearch.toLowerCase()) || o.deliveryDetails?.name?.toLowerCase().includes(orderSearch.toLowerCase()));
  const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(userSearch.toLowerCase()) || u.name?.toLowerCase().includes(userSearch.toLowerCase()));
  const filteredMenuItems = menuItemsList.filter(m => m.title.toLowerCase().includes(menuItemSearch.toLowerCase()) || m.category?.toLowerCase().includes(menuItemSearch.toLowerCase()));

  const tabs = [
    { id: 'analytics', label: 'Analytics' },
    { id: 'orders', label: 'Orders' },
    { id: 'history', label: 'History' },
    { id: 'menu', label: 'Menu Items' },
    { id: 'packages', label: 'Packages' },
    { id: 'categories', label: 'Categories' },
    { id: 'promos', label: 'Promo Codes' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'users', label: 'Users' }
  ];

  return (
    <main className="pt-36 pb-32 px-6 max-w-5xl mx-auto">
      <h1 className="font-headline text-3xl font-bold mb-6 text-primary">Admin Dashboard</h1>
      
      <div className="flex gap-3 overflow-x-auto mb-8 pb-2 scrollbar-hide">
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && (
        <section className="mb-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <h2 className="text-xl font-bold">Recent Orders</h2>
              <input 
                type="text" 
                placeholder="Search orders by ID or Name..." 
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                className="p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm w-full md:w-64"
              />
          </div>
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
              {['pending', 'preparing', 'delivering', 'completed', 'cancelled'].map(status => (
                <Droppable key={status} droppableId={status}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 min-w-[300px] bg-surface-container-low p-4 rounded-xl flex flex-col gap-3 ${snapshot.isDraggingOver ? 'bg-surface-container-high' : ''}`}
                    >
                      <h3 className="font-bold text-lg capitalize border-b border-outline-variant/20 pb-2 mb-2 flex justify-between items-center">
                        {status}
                        <span className="bg-surface-container-highest text-xs px-2 py-1 rounded-full">
                          {filteredOrders.filter(o => o.status === status).length}
                        </span>
                      </h3>
                      
                      {filteredOrders.filter(o => o.status === status).map((o, index) => (
                        <React.Fragment key={o.id}>
                          {/* @ts-expect-error React 19 type issue with key */}
                          <Draggable key={o.id} draggableId={o.id} index={index}>
                            {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-surface p-4 rounded-lg border border-outline-variant/30 shadow-sm ${snapshot.isDragging ? 'shadow-lg border-primary' : ''}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-bold text-sm">{o.id}</div>
                                  <div className="text-xs text-on-surface-variant">{new Date(o.createdAt).toLocaleString()}</div>
                                </div>
                                <div className="font-bold text-primary">${o.total}</div>
                              </div>
                              <div className="text-sm mb-3">
                                <span className="font-semibold">{o.deliveryDetails?.name}</span>
                                <div className="text-xs text-on-surface-variant mt-1 line-clamp-1">{o.deliveryDetails?.address}</div>
                              </div>
                              
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}
                                  className="flex-1 text-center text-xs font-bold bg-surface-container-high py-2 rounded hover:bg-surface-container-highest transition-colors"
                                >
                                  {expandedOrderId === o.id ? 'Hide Details' : 'View Details'}
                                </button>
                              </div>
                              
                              {expandedOrderId === o.id && (
                                <div className="mt-3 pt-3 border-t border-outline-variant/20 text-xs space-y-3">
                                  <div>
                                    <h4 className="font-bold mb-1">Items:</h4>
                                    <ul className="space-y-1">
                                      {o.items?.map((item: any, idx: number) => {
                                        const hasSpecs = (item.addons && item.addons.length > 0) || item.specialInstructions;
                                        return (
                                        <li key={idx} className="bg-surface-container-low p-2 rounded">
                                          <div className="font-semibold">{item.qty}x {item.title}</div>
                                          {hasSpecs && (
                                            <div className="text-on-surface-variant mt-1 pl-2 border-l-2 border-primary/30">
                                              {item.addons?.map((a: any) => <div key={a.id}>{a.title} {a.qty ? `(x${a.qty})` : ''}</div>)}
                                              {item.specialInstructions && <div className="text-error italic">Note: {item.specialInstructions}</div>}
                                            </div>
                                          )}
                                        </li>
                                      )})}
                                    </ul>
                                  </div>
                                  <div>
                                    <h4 className="font-bold mb-1">Delivery Details:</h4>
                                    <div className="mb-1"><span className="font-semibold">Address:</span> {o.deliveryDetails?.address}</div>
                                    <div className="mb-1"><span className="font-semibold">Contact:</span> {o.deliveryDetails?.phone}</div>
                                    <div className="mb-1"><span className="font-semibold">Payment:</span> {o.deliveryDetails?.paymentMethod === 'omt' ? 'Whish' : o.deliveryDetails?.paymentMethod === 'pod' ? 'Pay on Delivery' : o.deliveryDetails?.paymentMethod || 'Pay on Delivery'}</div>
                                    {o.deliveryDetails?.locationLink && <div className="mb-1"><span className="font-semibold">Maps Link:</span> <a href={o.deliveryDetails.locationLink} target="_blank" rel="noreferrer" className="text-primary underline break-all">View Map</a></div>}
                                    {o.deliveryDetails?.instructions && <div className="italic mt-1 text-on-surface-variant">Note: "{o.deliveryDetails.instructions}"</div>}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                        </React.Fragment>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="mb-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <h2 className="text-xl font-bold">Order History <span className="text-sm font-normal text-on-surface-variant font-sans">(inc. deleted)</span></h2>
              <input 
                type="text" 
                placeholder="Search orders by ID or Name..." 
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                className="p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm w-full md:w-64"
              />
          </div>
          <div className="bg-surface-container-low rounded-xl overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-surface-container-highest">
                      <tr><th className="p-4">Date</th><th className="p-4">Order ID</th><th className="p-4">Status</th><th className="p-4">Customer</th><th className="p-4">Total</th><th className="p-4">Items</th></tr>
                  </thead>
                  <tbody>
                      {historyOrders.map(o => (
                          <tr key={o.id} className={`border-b border-outline-variant/10 ${o.isDeleted ? 'opacity-60 bg-error/5' : ''}`}>
                              <td className="p-4">{new Date(o.createdAt).toLocaleString()}</td>
                              <td className="p-4 font-bold">{o.id} {o.isDeleted && <span className="text-[10px] text-error ml-2 uppercase">(Deleted)</span>}</td>
                              <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${o.status === 'cancelled' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>{o.status}</span></td>
                              <td className="p-4">{o.deliveryDetails?.name}</td>
                              <td className="p-4">${o.total}</td>
                              <td className="p-4 max-w-[200px] truncate">{o.items?.map((i:any) => `${i.qty}x ${i.title}`).join(', ')}</td>
                          </tr>
                      ))}
                      {historyOrders.length === 0 && (
                        <tr><td colSpan={6} className="p-4 text-center text-on-surface-variant">No orders found.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
        </section>
      )}

      {activeTab === 'menu' && (
        <section className="mb-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <h2 className="text-xl font-bold">Menu Management</h2>
              <div className="flex gap-2 w-full md:w-auto">
                <input 
                  type="text" 
                  placeholder="Search items..." 
                  value={menuItemSearch}
                  onChange={e => setMenuItemSearch(e.target.value)}
                  className="flex-1 p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm"
                />
                <button onClick={() => openEditItem(null)} className="bg-primary text-on-primary px-4 py-2 rounded text-sm font-bold shrink-0">Add New Item</button>
              </div>
          </div>
          <div className="overflow-x-auto bg-surface-container-low rounded-xl">
              <table className="w-full text-left text-sm">
                  <thead className="bg-surface-container-high">
                      <tr><th className="p-4">Image</th><th className="p-4">Title</th><th className="p-4">Category</th><th className="p-4">Price</th><th className="p-4">Status</th><th className="p-4">Action</th></tr>
                  </thead>
                  <tbody>
                      {filteredMenuItems.filter(i => i.category !== 'PACKAGES').map(item => (
                          <tr key={item.id} className="border-b border-outline-variant/10">
                              <td className="p-4"><CachedImage src={item.img} alt={item.title} className="w-10 h-10 rounded object-cover" /></td>
                              <td className="p-4">{item.title}</td>
                              <td className="p-4 capitalize">{item.category}</td>
                              <td className="p-4">${item.price.replace('$', '')}</td>
                              <td className="p-4">
                                  <button onClick={() => toggleAvailability(item)} className={`px-2 py-1 rounded text-xs font-bold ${item.available !== false ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                                      {item.available !== false ? 'Available' : 'Unavailable'}
                                  </button>
                              </td>
                              <td className="p-4">
                                  <button onClick={() => openEditItem(item)} className="text-primary font-bold text-xs">Edit</button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
        </section>
      )}

      {activeTab === 'packages' && (
        <section className="mb-12">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Packages Management</h2>
              <button onClick={() => openEditItem({ category: 'PACKAGES' } as MenuItem)} className="bg-primary text-on-primary px-4 py-2 rounded text-sm font-bold">Add New Package</button>
          </div>
          <div className="overflow-x-auto bg-surface-container-low rounded-xl">
              <table className="w-full text-left text-sm">
                  <thead className="bg-surface-container-high">
                      <tr><th className="p-4">Image</th><th className="p-4">Title</th><th className="p-4">Category</th><th className="p-4">Price</th><th className="p-4">Status</th><th className="p-4">Action</th></tr>
                  </thead>
                  <tbody>
                      {menuItemsList.filter(i => i.category === 'PACKAGES').map(item => (
                          <tr key={item.id} className="border-b border-outline-variant/10">
                              <td className="p-4"><CachedImage src={item.img} alt={item.title} className="w-10 h-10 rounded object-cover" /></td>
                              <td className="p-4">{item.title}</td>
                              <td className="p-4 capitalize">{item.category}</td>
                              <td className="p-4">${item.price.replace('$', '')}</td>
                              <td className="p-4">
                                  <button onClick={() => toggleAvailability(item)} className={`px-2 py-1 rounded text-xs font-bold ${item.available !== false ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                                      {item.available !== false ? 'Available' : 'Unavailable'}
                                  </button>
                              </td>
                              <td className="p-4">
                                  <button onClick={() => openEditItem(item)} className="text-primary font-bold text-xs">Edit</button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
        </section>
      )}

      {activeTab === 'categories' && (
        <section className="mb-12">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Category Management</h2>
              <button onClick={() => setEditingCategory({} as MenuCategory)} className="bg-primary text-on-primary px-4 py-2 rounded text-sm font-bold">Add Category</button>
          </div>
          <div className="overflow-x-auto bg-surface-container-low rounded-xl">
              <table className="w-full text-left text-sm">
                  <thead className="bg-surface-container-high">
                      <tr><th className="p-4">Order</th><th className="p-4">Name</th><th className="p-4">Action</th></tr>
                  </thead>
                  <tbody>
                      {categoriesList.map(cat => (
                          <tr key={cat.id} className="border-b border-outline-variant/10">
                              <td className="p-4">{cat.order}</td>
                              <td className="p-4 capitalize">{cat.name}</td>
                              <td className="p-4">
                                  <button onClick={() => setEditingCategory(cat)} className="text-primary font-bold text-xs">Edit</button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
        </section>
      )}

      {activeTab === 'reviews' && (
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">Review Moderation</h2>
          <div className="overflow-x-auto bg-surface-container-low rounded-xl">
              <table className="w-full text-left text-sm">
                  <thead className="bg-surface-container-high">
                      <tr><th className="p-4">User</th><th className="p-4">Rating</th><th className="p-4">Comment</th><th className="p-4">Status</th><th className="p-4">Action</th></tr>
                  </thead>
                  <tbody>
                      {reviews.map(r => (
                          <tr key={r.id} className="border-b border-outline-variant/10">
                              <td className="p-4 font-bold">{r.userName}</td>
                              <td className="p-4">{r.rating}/5</td>
                              <td className="p-4 max-w-xs truncate">{r.comment}</td>
                              <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${r.status === 'approved' ? 'bg-primary/10 text-primary' : r.status === 'rejected' ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}`}>
                                      {r.status || 'pending'}
                                  </span>
                              </td>
                              <td className="p-4 flex gap-2">
                                  <button onClick={() => updateReviewStatus(r.id, 'approved')} className="text-primary font-bold text-xs">Approve</button>
                                  <button onClick={() => updateReviewStatus(r.id, 'rejected')} className="text-error font-bold text-xs">Reject</button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
        </section>
      )}

      {activeTab === 'users' && (
        <>
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-4">Add New Admin</h2>
            <form onSubmit={handleAddAdmin} className="flex gap-4 bg-surface-container-low p-6 rounded-xl">
                <input 
                    type="email" 
                    placeholder="Enter user email..." 
                    value={newAdminEmail}
                    onChange={e => setNewAdminEmail(e.target.value)}
                    required
                    className="flex-1 p-3 rounded bg-surface border border-outline-variant/30 text-sm"
                />
                <button type="submit" className="bg-primary text-on-primary px-6 py-3 rounded font-bold text-sm">Add Admin</button>
            </form>
          </section>

          <section>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h2 className="text-xl font-bold">Signed Up Users</h2>
                <input 
                  type="text" 
                  placeholder="Search users by Name or Email..." 
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm w-full md:w-64"
                />
            </div>
            <div className="overflow-x-auto bg-surface-container-low rounded-xl">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface-container-high">
                        <tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Role</th></tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(u => (
                            <tr key={u.uid} className="border-b border-outline-variant/10">
                                <td className="p-4">{u.name}</td>
                                <td className="p-4">{u.email}</td>
                                <td className="p-4 capitalize">{u.role}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'promos' && (
        <>
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-4">Add Promo Code</h2>
            <form onSubmit={savePromo} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-container-low p-6 rounded-xl">
                <div>
                  <label className="block text-xs font-bold mb-1">Code</label>
                  <input name="code" placeholder="e.g. SUMMER10" required className="w-full p-3 rounded bg-surface border border-outline-variant/30 text-sm uppercase" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Discount Type</label>
                  <select name="discountType" className="w-full p-3 rounded bg-surface border border-outline-variant/30 text-sm">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Discount Value</label>
                  <input name="discountValue" type="number" step="0.01" min="0" required className="w-full p-3 rounded bg-surface border border-outline-variant/30 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Max Uses Overall</label>
                  <input name="maxUsesOverall" type="number" min="1" defaultValue="100" required className="w-full p-3 rounded bg-surface border border-outline-variant/30 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Max Uses Per User</label>
                  <input name="maxUsesPerUser" type="number" min="1" defaultValue="1" required className="w-full p-3 rounded bg-surface border border-outline-variant/30 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Expiry Date (Optional)</label>
                  <input name="expiryDate" type="date" className="w-full p-3 rounded bg-surface border border-outline-variant/30 text-sm" />
                </div>
                <div className="flex items-end md:col-span-2">
                  <button type="submit" className="w-full bg-primary text-on-primary px-6 py-3 rounded font-bold text-sm">Add Promo</button>
                </div>
            </form>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4">Active Promo Codes</h2>
            <div className="overflow-x-auto bg-surface-container-low rounded-xl">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface-container-high">
                        <tr>
                          <th className="p-4">Code</th>
                          <th className="p-4">Discount</th>
                          <th className="p-4">Uses</th>
                          <th className="p-4">Per User</th>
                          <th className="p-4">Expiry Date</th>
                          <th className="p-4">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {promos.map(p => (
                            <tr key={p.id} className="border-b border-outline-variant/10">
                                <td className="p-4 font-bold">{p.code}</td>
                                <td className="p-4">{p.discountType === 'percentage' ? `${p.discountValue}%` : `$${p.discountValue}`}</td>
                                <td className="p-4">{p.currentUses} / {p.maxUsesOverall}</td>
                                <td className="p-4">{p.maxUsesPerUser}</td>
                                <td className="p-4">{p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : 'Never'}</td>
                                <td className="p-4">
                                    <button onClick={() => deletePromo(p.id)} className="text-error font-bold">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {promos.length === 0 && (
                          <tr><td colSpan={6} className="p-4 text-center text-on-surface-variant">No promo codes found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'analytics' && (
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold">Business Dashboard</h2>
            <div className="flex gap-2 items-center flex-wrap">
              <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="p-2 rounded bg-surface border border-outline-variant/30 text-sm" />
              <span className="text-on-surface-variant">to</span>
              <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="p-2 rounded bg-surface border border-outline-variant/30 text-sm" />
              <button onClick={exportSalesData} className="bg-primary text-on-primary px-4 py-2 rounded font-bold text-sm">Export Sales Data</button>
            </div>
          </div>
          {(() => {
            const validOrders = orders.filter(o => o.status !== 'cancelled' && !o.isDeleted);
            const totalRevenue = validOrders.reduce((sum, o) => sum + Number(o.total), 0);
            const totalOrders = validOrders.length;
            const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            
            // Top selling items
            const itemCounts = validOrders.flatMap(o => o.items).reduce((acc, item) => {
              acc[item.title] = (acc[item.title] || 0) + (item.quantity || 1);
              return acc;
            }, {} as Record<string, number>);
            const topItems = Object.entries(itemCounts).map(([title, quantity]) => ({ title, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

            // Chart data: Last 7 Days
            const chartData = Array.from({ length: 7 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                const dateStr = d.toLocaleDateString();
                return { date: dateStr, revenue: 0, orders: 0 };
            });

            validOrders.forEach(o => {
                const dateStr = new Date(o.createdAt).toLocaleDateString();
                const dayData = chartData.find(d => d.date === dateStr);
                if (dayData) {
                    dayData.revenue += Number(o.total);
                    dayData.orders += 1;
                }
            });

            return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-center">
                      <h3 className="text-on-surface-variant text-sm font-bold mb-2">Total Revenue</h3>
                      <p className="text-4xl font-headline text-primary">${totalRevenue.toFixed(2)}</p>
                    </div>
                    <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-center">
                      <h3 className="text-on-surface-variant text-sm font-bold mb-2">Total Orders</h3>
                      <p className="text-4xl font-headline text-primary">{totalOrders}</p>
                    </div>
                    <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-center">
                      <h3 className="text-on-surface-variant text-sm font-bold mb-2">Avg. Order Value</h3>
                      <p className="text-4xl font-headline text-primary">${aov.toFixed(2)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="bg-surface-container-low p-6 rounded-xl col-span-1 lg:col-span-2 overflow-hidden w-full">
                        <h3 className="text-on-surface-variant text-sm font-bold mb-6">Revenue (Last 7 Days)</h3>
                        <div className="w-full h-[300px]">
                            <ResponsiveContainer width="99%" height={300}>
                              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <Line type="monotone" dataKey="revenue" stroke="#E4CD86" strokeWidth={3} dot={{ r: 4, fill: '#E4CD86' }} activeDot={{ r: 6 }} />
                                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" opacity={0.2} vertical={false} />
                                <XAxis dataKey="date" stroke="#888" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                                <YAxis stroke="#888" tickFormatter={(val) => `$${val}`} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} contentStyle={{ backgroundColor: '#1E1E1E', border: 'none', borderRadius: '8px', color: '#fff' }} />
                              </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    
                    <div className="bg-surface-container-low p-6 rounded-xl col-span-1 flex flex-col">
                        <h3 className="text-on-surface-variant text-sm font-bold mb-6">Top Selling Items</h3>
                        <div className="flex-grow flex flex-col gap-4">
                            {topItems.length > 0 ? topItems.map((item, index) => (
                                <div key={index} className="flex justify-between items-center bg-surface p-3 rounded border border-outline-variant/20">
                                    <span className="font-bold text-sm truncate pr-4">{item.title}</span>
                                    <span className="bg-primary/20 text-primary font-bold px-2 py-1 rounded text-xs whitespace-nowrap">{item.quantity} sold</span>
                                </div>
                            )) : (
                                <div className="text-sm text-on-surface-variant flex items-center justify-center h-full">No items sold yet.</div>
                            )}
                        </div>
                    </div>
                  </div>
                </>
            );
          })()}
        </section>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface w-full max-w-2xl rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto">
                <button className="absolute top-4 right-4 text-on-surface-variant" onClick={() => setEditingItem(null)}>
                    <span className="material-symbols-outlined">close</span>
                </button>
                <h2 className="font-headline text-2xl mb-6">{editingItem.id ? 'Edit Item' : 'Add New Item'}</h2>
                
                <form onSubmit={saveMenuItem} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">Title</label>
                            <input name="title" defaultValue={editingItem.title} required className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold mb-1">Categories (Check all that apply)</label>
                            <div className="flex flex-wrap gap-3 p-3 rounded bg-surface-container-low border border-outline-variant/30 max-h-32 overflow-y-auto">
                                {categoriesList.map(cat => (
                                  <label key={cat.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                    <input 
                                      type="checkbox"
                                      className="rounded text-primary"
                                      checked={editingItemCategories.includes(cat.name)}
                                      onChange={(e) => {
                                        if (e.target.checked) setEditingItemCategories([...editingItemCategories, cat.name]);
                                        else setEditingItemCategories(editingItemCategories.filter(c => c !== cat.name));
                                      }}
                                    />
                                    <span>{cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}</span>
                                  </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Price</label>
                            <input name="price" defaultValue={editingItem.price} required placeholder="$0.00" className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                        </div>
                        {editingItemCategories.includes('PACKAGES') && (
                          <div>
                              <label className="block text-xs font-bold mb-1">Compare-at Price</label>
                              <input name="originalPrice" defaultValue={editingItem.originalPrice} placeholder="$0.00" className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                          </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold mb-1">Image URL or Upload</label>
                            <div className="flex flex-col gap-2">
                              <input name="img" defaultValue={editingItem.img} placeholder="Image URL" className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                              <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm" />
                              {imageUpload && <span className="text-xs text-primary font-bold">Image loaded from file</span>}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Prep Time</label>
                            <input name="prepTime" defaultValue={editingItem.prepTime} placeholder="e.g., 15 mins" className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">Description</label>
                        <textarea name="desc" defaultValue={editingItem.desc} rows={2} required className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30 text-sm"></textarea>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">
                          {(editingItemCategories.includes('COMBOS') || editingItem.category === 'COMBOS' || editingItemCategories.includes('combos')) ? 'Item' : 'Ingredients'}
                        </label>
                        <textarea name="ingredients" defaultValue={editingItem.ingredients} rows={3} required className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30 text-sm"></textarea>
                    </div>
                    
                    <div className="border-t border-outline-variant/20 pt-4 mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-sm">Sizes & Calorie Options</h3>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={editingItemShowOptions} onChange={e => setEditingItemShowOptions(e.target.checked)} className="rounded text-primary" />
                          <span className="text-xs font-bold text-on-surface-variant">Enable 450 Cal / 700 Cal Options</span>
                        </label>
                      </div>
                      
                      {editingItemShowOptions ? (
                        <div className="space-y-4 mb-4">
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <label className="block text-xs font-bold mb-1">Price for 450 Cal</label>
                              <input type="text" value={price450} onChange={e => setPrice450(e.target.value)} placeholder="e.g. $10.00" className="w-full p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                            </div>
                            <div className="flex-1 flex gap-2 items-end">
                               <input type="text" value={macros450.protein} onChange={e => setMacros450({...macros450, protein: e.target.value})} placeholder="Pro (g)" className="w-full p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                               <input type="text" value={macros450.carbs} onChange={e => setMacros450({...macros450, carbs: e.target.value})} placeholder="Carbs (g)" className="w-full p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                               <input type="text" value={macros450.fats} onChange={e => setMacros450({...macros450, fats: e.target.value})} placeholder="Fat (g)" className="w-full p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <label className="block text-xs font-bold mb-1">Price for 700 Cal</label>
                              <input type="text" value={price700} onChange={e => setPrice700(e.target.value)} placeholder="e.g. $15.00" className="w-full p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                            </div>
                            <div className="flex-1 flex gap-2 items-end">
                               <input type="text" value={macros700.protein} onChange={e => setMacros700({...macros700, protein: e.target.value})} placeholder="Pro (g)" className="w-full p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                               <input type="text" value={macros700.carbs} onChange={e => setMacros700({...macros700, carbs: e.target.value})} placeholder="Carbs (g)" className="w-full p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                               <input type="text" value={macros700.fats} onChange={e => setMacros700({...macros700, fats: e.target.value})} placeholder="Fat (g)" className="w-full p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 mb-2">
                          {editingItemSizes.map((size, idx) => (
                            <div key={idx} className="flex flex-col gap-2">
                              <div className="flex gap-2 items-center">
                                <input type="text" value={size.label} onChange={e => {
                                  const newSizes = [...editingItemSizes];
                                  newSizes[idx].label = e.target.value;
                                  setEditingItemSizes(newSizes);
                                }} placeholder="Size (e.g. Small)" className="flex-1 p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                                <input type="text" value={size.price} onChange={e => {
                                  const newSizes = [...editingItemSizes];
                                  newSizes[idx].price = e.target.value;
                                  setEditingItemSizes(newSizes);
                                }} placeholder="Price (e.g. $10.00)" className="w-24 p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                                <button type="button" onClick={() => setEditingItemSizes(editingItemSizes.filter((_, i) => i !== idx))} className="text-error font-bold text-xs">Remove</button>
                              </div>
                              <div className="flex gap-2 w-full">
                                <input type="text" value={size.protein || ''} onChange={e => {
                                  const newSizes = [...editingItemSizes];
                                  newSizes[idx].protein = e.target.value;
                                  setEditingItemSizes(newSizes);
                                }} placeholder="Protein (g)" className="flex-1 p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                                <input type="text" value={size.carbs || ''} onChange={e => {
                                  const newSizes = [...editingItemSizes];
                                  newSizes[idx].carbs = e.target.value;
                                  setEditingItemSizes(newSizes);
                                }} placeholder="Carbs (g)" className="flex-1 p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                                <input type="text" value={size.fats || ''} onChange={e => {
                                  const newSizes = [...editingItemSizes];
                                  newSizes[idx].fats = e.target.value;
                                  setEditingItemSizes(newSizes);
                                }} placeholder="Fat (g)" className="flex-1 p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {!editingItemShowOptions && (
                        <button type="button" onClick={() => setEditingItemSizes([...editingItemSizes, {label: '', price: ''}])} className="text-primary font-bold text-xs">+ Add Size</button>
                      )}
                    </div>

                    <div className="border-t border-outline-variant/20 pt-4 mt-4">
                      <h3 className="font-bold text-sm mb-2">Add-ons</h3>
                      <label className="flex items-center gap-2 mb-4">
                        <input type="checkbox" checked={editingItemAllowFries} onChange={e => setEditingItemAllowFries(e.target.checked)} className="rounded text-primary" />
                        <span className="text-sm">Allow Fries & Soft Drinks</span>
                      </label>

                      <label className="flex items-center gap-2 mb-2">
                        <input type="checkbox" checked={editingItemAllowSauces} onChange={e => setEditingItemAllowSauces(e.target.checked)} className="rounded text-primary" />
                        <span className="text-sm">Allow Sauces</span>
                      </label>
                      
                      {editingItemAllowSauces && (
                        <div className="pl-6">
                          <div className="space-y-2 mb-2">
                            {editingItemSauces.map((sauce, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <input type="text" value={sauce} onChange={e => {
                                  const newSauces = [...editingItemSauces];
                                  newSauces[idx] = e.target.value;
                                  setEditingItemSauces(newSauces);
                                }} placeholder="Sauce Name" className="flex-1 p-2 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                                <button type="button" onClick={() => setEditingItemSauces(editingItemSauces.filter((_, i) => i !== idx))} className="text-error font-bold text-xs">Remove</button>
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => setEditingItemSauces([...editingItemSauces, ''])} className="text-primary font-bold text-xs">+ Add Sauce</button>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4 mt-4">
                        {editingItem.id && <button type="button" onClick={() => deleteMenuItem(editingItem.id)} className="w-full bg-error text-on-error py-3 rounded-xl font-bold">Delete Item</button>}
                        <button type="submit" className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold">Save Item</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface w-full max-w-md rounded-2xl p-6 relative">
                <button className="absolute top-4 right-4 text-on-surface-variant" onClick={() => setEditingCategory(null)}>
                    <span className="material-symbols-outlined">close</span>
                </button>
                <h2 className="font-headline text-2xl mb-6">{editingCategory.id ? 'Edit Category' : 'Add New Category'}</h2>
                
                <form onSubmit={saveCategory} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold mb-1">Name</label>
                        <input name="name" defaultValue={editingCategory.name} required className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">Order (Number)</label>
                        <input name="order" type="number" defaultValue={editingCategory.order || categoriesList.length + 1} required className="w-full p-3 rounded bg-surface-container-low border border-outline-variant/30 text-sm" />
                    </div>
                    <div className="flex gap-4 mt-4">
                        {editingCategory.id && <button type="button" onClick={() => deleteCategory(editingCategory.id)} className="w-full bg-error text-on-error py-3 rounded-xl font-bold">Delete Category</button>}
                        <button type="submit" className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold">Save Category</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {categoryToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface w-full max-w-sm rounded-2xl p-6 relative">
                <h2 className="font-headline text-2xl mb-4 text-error">Delete Category</h2>
                <p className="text-on-surface-variant mb-6">Are you sure you want to delete this category? This action cannot be undone.</p>
                <div className="flex gap-4">
                    <button onClick={() => setCategoryToDelete(null)} className="flex-1 py-3 rounded-xl font-bold bg-surface-container-high text-on-surface">Cancel</button>
                    <button onClick={confirmDeleteCategory} className="flex-1 py-3 rounded-xl font-bold bg-error text-on-error">Delete</button>
                </div>
            </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface w-full max-w-sm rounded-2xl p-6 relative">
                <h2 className="font-headline text-2xl mb-4 text-error">Delete Item</h2>
                <p className="text-on-surface-variant mb-6">Are you sure you want to delete this menu item? This action cannot be undone.</p>
                <div className="flex gap-4">
                    <button onClick={() => setItemToDelete(null)} className="flex-1 py-3 rounded-xl font-bold bg-surface-container-high text-on-surface">Cancel</button>
                    <button onClick={confirmDeleteMenuItem} className="flex-1 py-3 rounded-xl font-bold bg-error text-on-error">Delete</button>
                </div>
            </div>
        </div>
      )}
    </main>
  );
}