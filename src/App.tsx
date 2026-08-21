import { useEffect } from 'react';
import { useRoute, matchRoute, navigate } from '@/components/router/Router';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { StoreLayout } from '@/layouts/StoreLayout';
import { AdminLayout } from '@/layouts/AdminLayout';

import { HomePage } from '@/pages/HomePage';
import { ProductsPage } from '@/pages/ProductsPage';
import { ProductDetailPage } from '@/pages/ProductDetailPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { AccountPage } from '@/pages/AccountPage';
import { OrderDetailPage } from '@/pages/OrderDetailPage';

import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminProducts } from '@/pages/admin/AdminProducts';
import { AdminCategories } from '@/pages/admin/AdminCategories';
import { AdminOrders } from '@/pages/admin/AdminOrders';
import { AdminPayments } from '@/pages/admin/AdminPayments';
import { AdminCustomers } from '@/pages/admin/AdminCustomers';
import { AdminAdmins } from '@/pages/admin/AdminAdmins';
import { AdminPaymentMethods } from '@/pages/admin/AdminPaymentMethods';
import { AdminQrCodes } from '@/pages/admin/AdminQrCodes';
import { AdminShipping } from '@/pages/admin/AdminShipping';
import { AdminCoupons } from '@/pages/admin/AdminCoupons';
import { AdminSettings } from '@/pages/admin/AdminSettings';

function AppRoutes() {
  const route = useRoute();
  const path = route.split('?')[0];
  const { isAdmin } = useAuth();

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        navigate(isAdmin ? '/admin/dashboard' : '/admin');
      }
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [isAdmin]);

  // Auth pages (no layout)
  if (path === '/login') return <LoginPage />;
  if (path === '/signup') return <SignupPage />;

  // Admin routes
  if (path === '/admin' || path.startsWith('/admin/')) {
    let content;
    if (path === '/admin' || path === '/admin/dashboard') content = <AdminDashboard />;
    else if (path === '/admin/products') content = <AdminProducts />;
    else if (path === '/admin/categories') content = <AdminCategories />;
    else if (path === '/admin/orders') content = <AdminOrders />;
    else if (path === '/admin/payments') content = <AdminPayments />;
    else if (path === '/admin/customers') content = <AdminCustomers />;
    else if (path === '/admin/admins') content = <AdminAdmins />;
    else if (path === '/admin/payment-methods') content = <AdminPaymentMethods />;
    else if (path === '/admin/qr-codes') content = <AdminQrCodes />;
    else if (path === '/admin/shipping') content = <AdminShipping />;
    else if (path === '/admin/coupons') content = <AdminCoupons />;
    else if (path === '/admin/settings') content = <AdminSettings />;
    else content = <AdminDashboard />;
    return <AdminLayout>{content}</AdminLayout>;
  }

  // Customer routes (store layout)
  let content;
  if (path === '/') content = <HomePage />;
  else if (path === '/products') content = <ProductsPage />;
  else if (path === '/categories') content = <CategoriesPage />;
  else if (path === '/cart') content = <CartPage />;
  else if (path === '/checkout') content = <CheckoutPage />;
  else if (path === '/account') content = <AccountPage />;
  else if (path === '/account/orders') content = <AccountPage />;
  else {
    const productMatch = matchRoute('/product/:id', path);
    const orderMatch = matchRoute('/account/orders/:id', path);
    if (productMatch) content = <ProductDetailPage id={productMatch.id} />;
    else if (orderMatch) content = <OrderDetailPage id={orderMatch.id} />;
    else content = <HomePage />;
  }

  return <StoreLayout>{content}</StoreLayout>;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <CartProvider>
          <AppRoutes />
        </CartProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
