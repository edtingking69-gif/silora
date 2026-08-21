import { useEffect, useState } from 'react';
import { Link, navigate } from '@/components/router/Router';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { fetchPaymentMethods, fetchShippingConfig, fetchUserAddresses, validateCoupon } from '@/services/api';
import type { Address, PaymentMethod, ShippingConfig, Coupon } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatINR } from '@/utils/format';
import { Check, ChevronRight, MapPin, CreditCard, ShoppingBag, Tag, Truck, Copy, QrCode } from 'lucide-react';
import { classNames } from '@/utils/format';

type Step = 1 | 2 | 3;

export function CheckoutPage() {
  const { items } = useCart();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [newAddress, setNewAddress] = useState({
    full_name: profile?.full_name ?? '',
    mobile: profile?.mobile ?? '',
    line1: '', line2: '', city: '', state: '', pincode: '', label: 'Home',
  });
  const [useNew, setUseNew] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');

  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchUserAddresses(user.id).then((a) => {
      setAddresses(a);
      const def = a.find((x) => x.is_default);
      setSelectedAddressId(def?.id ?? a[0]?.id ?? '');
      if (a.length === 0) setUseNew(true);
    });
    fetchPaymentMethods().then((m) => {
      setPaymentMethods(m);
      setSelectedMethod(m[0]?.id ?? '');
    });
    fetchShippingConfig().then(setShippingConfig);
  }, [user]);

  const subtotal = items.reduce((sum, i) => {
    const price = i.variant?.price_override ? Number(i.variant.price_override) : Number(i.product?.price ?? 0);
    return sum + price * i.quantity;
  }, 0);
  const shippingFee = shippingConfig?.shipping_fee ?? 0;
  const freeThreshold = shippingConfig?.free_shipping_threshold ?? 0;
  const freeEnabled = shippingConfig?.enabled ?? true;
  const shipping = freeEnabled && (freeThreshold === 0 || subtotal >= freeThreshold) ? 0 : shippingFee;
  const total = Math.max(0, subtotal - discount + shipping);

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponError('');
    const { coupon, discount, error } = await validateCoupon(couponCode, subtotal);
    if (error) {
      setCouponError(error);
      setAppliedCoupon(null);
      setDiscount(0);
      return;
    }
    setAppliedCoupon(coupon);
    setDiscount(discount);
    toast(`Coupon ${coupon!.code} applied! You saved ${formatINR(discount)}`);
  }

  function validateStep1(): boolean {
    if (useNew) {
      if (!newAddress.full_name || !newAddress.mobile || !newAddress.line1 || !newAddress.city || !newAddress.state || !newAddress.pincode) {
        toast('Please fill all required address fields', 'error');
        return false;
      }
      if (!/^\d{6}$/.test(newAddress.pincode)) {
        toast('Please enter a valid 6-digit pincode', 'error');
        return false;
      }
    } else if (!selectedAddressId) {
      toast('Please select a delivery address', 'error');
      return false;
    }
    return true;
  }

  async function handlePlaceOrder() {
    if (!user) return;
    if (!selectedMethod) {
      toast('Please select a payment method', 'error');
      return;
    }
    if (items.length === 0) {
      toast('Your cart is empty', 'error');
      return;
    }

    setPlacing(true);
    try {
      let addressData: Record<string, string>;
      if (useNew) {
        addressData = { ...newAddress };
      } else {
        const addr = addresses.find((a) => a.id === selectedAddressId);
        if (!addr) { toast('Address not found', 'error'); return; }
        addressData = {
          full_name: addr.full_name, mobile: addr.mobile,
          line1: addr.line1, line2: addr.line2 ?? '', city: addr.city,
          state: addr.state, pincode: addr.pincode, label: addr.label,
        };
      }

      const itemsJson = items.map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id,
        quantity: i.quantity,
      }));

      const { data, error } = await supabase.rpc('create_order', {
        p_items: itemsJson,
        p_address: addressData,
        p_coupon_code: appliedCoupon?.code ?? null,
        p_payment_method_id: selectedMethod,
      });

      if (error) throw error;
      const result = data as { order_id: string; order_number: string };
      setOrderId(result.order_id);
      setOrderNumber(result.order_number);
      toast('Order placed successfully!');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to place order', 'error');
    } finally {
      setPlacing(false);
    }
  }

  async function handleSubmitPayment() {
    if (!orderId || !selectedMethod) return;
    setPlacing(true);
    try {
      const { error } = await supabase.rpc('submit_payment', {
        p_order_id: orderId,
        p_payment_method_id: selectedMethod,
        p_payment_reference: paymentRef || null,
      });
      if (error) throw error;
      setPaymentSubmitted(true);
      toast('Payment submitted — pending verification');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to submit payment', 'error');
    } finally {
      setPlacing(false);
    }
  }

  // Success screen
  if (orderNumber) {
    const selectedPm = paymentMethods.find((m) => m.id === selectedMethod);
    return (
      <div className="container-silora py-8">
        <div className="mx-auto max-w-lg">
          <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-100 text-success-600">
              <Check className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-ink-900">Order Placed!</h1>
            <p className="mt-2 text-sm text-ink-600">Your order <span className="font-bold text-ink-900">#{orderNumber}</span> has been created.</p>

            {selectedPm && (selectedPm.type === 'upi' || selectedPm.type === 'upi_qr') && !paymentSubmitted && (
              <div className="mt-6 rounded-2xl border border-primary-200 bg-primary-50 p-5 text-left">
                <h3 className="flex items-center gap-2 text-base font-bold text-ink-900">
                  <QrCode className="h-5 w-5 text-primary-600" /> Pay with UPI
                </h3>
                {selectedPm.upi_id && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-ink-600">SILORA UPI ID</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-bold text-ink-900">{selectedPm.upi_id}</code>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(selectedPm.upi_id!); toast('UPI ID copied'); }}
                        className="rounded-lg bg-primary-600 p-2 text-white"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                {selectedPm.payment_qr_codes?.filter((q) => q.enabled).map((qr) => (
                  <div key={qr.id} className="mt-3">
                    <p className="text-xs font-medium text-ink-600 mb-1">{qr.name}</p>
                    <img src={qr.image_url} alt={qr.name} className="mx-auto h-48 w-48 rounded-xl bg-white object-contain" />
                  </div>
                ))}
                <div className="mt-3 flex justify-between rounded-lg bg-white px-3 py-2">
                  <span className="text-sm text-ink-600">Amount to pay</span>
                  <span className="text-base font-bold text-primary-600">{formatINR(total)}</span>
                </div>
                {selectedPm.instructions && (
                  <p className="mt-2 text-xs text-ink-500">{selectedPm.instructions}</p>
                )}
                <Input
                  className="mt-3"
                  placeholder="Enter UTR / Payment Reference (optional)"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
                <Button onClick={handleSubmitPayment} loading={placing} className="mt-3 w-full" size="lg">
                  I've Paid
                </Button>
                <p className="mt-2 text-center text-xs text-ink-500">
                  Your payment will be verified by our team. Do not close this page until you've completed the payment.
                </p>
              </div>
            )}

            {paymentSubmitted && (
              <div className="mt-6 rounded-2xl border border-warning-200 bg-warning-50 p-5">
                <p className="text-sm font-semibold text-warning-700">Payment Submitted — Under Verification</p>
                <p className="mt-1 text-xs text-warning-600">We'll notify you once your payment is confirmed.</p>
              </div>
            )}

            {selectedPm?.type === 'cod' && (
              <div className="mt-6 rounded-2xl border border-success-200 bg-success-50 p-5">
                <p className="text-sm font-semibold text-success-700">Cash on Delivery</p>
                <p className="mt-1 text-xs text-success-600">Keep {formatINR(total)} ready for delivery.</p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Link to="/account/orders" className="flex-1 rounded-xl border border-ink-300 py-2.5 text-center text-sm font-semibold text-ink-700 hover:bg-ink-50">
                View Orders
              </Link>
              <Link to="/products" className="flex-1 rounded-xl bg-primary-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-primary-700">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-silora py-6">
        <EmptyState
          icon={<ShoppingBag className="h-8 w-8" />}
          title="Your cart is empty"
          message="Add products to your cart before checkout."
          action={<Link to="/products" className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white">Browse Products</Link>}
        />
      </div>
    );
  }

  const steps = [
    { num: 1, label: 'Address', icon: MapPin },
    { num: 2, label: 'Summary', icon: ShoppingBag },
    { num: 3, label: 'Payment', icon: CreditCard },
  ];

  return (
    <div className="container-silora py-6">
      <h1 className="text-xl font-bold text-ink-900 sm:text-2xl mb-5">Checkout</h1>

      {/* Stepper */}
      <div className="mb-6 flex items-center justify-center gap-2 sm:gap-4">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2 sm:gap-4">
            <div className={classNames(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
              step >= s.num ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-500',
            )}>
              <s.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-ink-300" />}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Step 1: Address */}
          {step === 1 && (
            <div className="rounded-2xl border border-ink-100 bg-white p-5">
              <h2 className="text-base font-bold text-ink-900 mb-4">Delivery Address</h2>

              {addresses.length > 0 && (
                <div className="mb-4 space-y-2">
                  {addresses.map((addr) => (
                    <label key={addr.id} className={classNames(
                      'flex cursor-pointer gap-3 rounded-xl border-2 p-3 transition-colors',
                      !useNew && selectedAddressId === addr.id ? 'border-primary-500 bg-primary-50' : 'border-ink-200 hover:border-ink-300',
                    )}>
                      <input
                        type="radio"
                        name="address"
                        checked={!useNew && selectedAddressId === addr.id}
                        onChange={() => { setSelectedAddressId(addr.id); setUseNew(false); }}
                        className="mt-1 h-4 w-4 text-primary-600"
                      />
                      <div className="text-sm">
                        <p className="font-semibold text-ink-900">{addr.full_name} · {addr.mobile}</p>
                        <p className="text-ink-600">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} - {addr.pincode}</p>
                        <span className="text-xs text-ink-400">{addr.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <button
                onClick={() => setUseNew(!useNew)}
                className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary-600"
              >
                <span>+ {useNew ? 'Cancel new address' : 'Add new address'}</span>
              </button>

              {useNew && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Full Name *" value={newAddress.full_name} onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })} />
                  <Input label="Mobile *" value={newAddress.mobile} onChange={(e) => setNewAddress({ ...newAddress, mobile: e.target.value })} />
                  <div className="sm:col-span-2">
                    <Input label="Address Line 1 *" value={newAddress.line1} onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Input label="Address Line 2" value={newAddress.line2} onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })} />
                  </div>
                  <Input label="City *" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} />
                  <Input label="State *" value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} />
                  <Input label="Pincode *" value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })} maxLength={6} />
                  <Select label="Label" value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}>
                    <option>Home</option>
                    <option>Work</option>
                    <option>Other</option>
                  </Select>
                </div>
              )}

              <Button
                onClick={() => validateStep1() && setStep(2)}
                className="mt-5 w-full"
                size="lg"
              >
                Continue to Summary
              </Button>
            </div>
          )}

          {/* Step 2: Summary */}
          {step === 2 && (
            <div className="rounded-2xl border border-ink-100 bg-white p-5">
              <h2 className="text-base font-bold text-ink-900 mb-4">Order Summary</h2>
              <div className="space-y-3">
                {items.map((item) => {
                  const price = item.variant?.price_override ? Number(item.variant.price_override) : Number(item.product?.price ?? 0);
                  return (
                    <div key={item.id} className="flex gap-3 rounded-xl border border-ink-100 p-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                        {item.product?.product_images?.[0]?.url && (
                          <img src={item.product.product_images[0].url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-ink-900 line-clamp-1">{item.product?.name}</p>
                        {item.variant && <p className="text-xs text-ink-500">{item.variant.name}: {item.variant.value}</p>}
                        <p className="text-xs text-ink-500">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-sm font-bold text-ink-900">{formatINR(price * item.quantity)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Coupon */}
              <div className="mt-4 rounded-xl border border-ink-100 p-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-ink-800 mb-2">
                  <Tag className="h-4 w-4 text-primary-600" /> Apply Coupon
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="h-10 flex-1 rounded-xl border border-ink-300 px-3 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  />
                  <Button onClick={handleApplyCoupon} variant="outline" size="sm">Apply</Button>
                </div>
                {couponError && <p className="mt-1.5 text-xs font-medium text-error-600">{couponError}</p>}
                {appliedCoupon && <p className="mt-1.5 text-xs font-medium text-success-600">Coupon {appliedCoupon.code} applied — You save {formatINR(discount)}</p>}
              </div>

              <div className="mt-5 flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button onClick={() => setStep(3)} className="flex-1">Continue to Payment</Button>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && (
            <div className="rounded-2xl border border-ink-100 bg-white p-5">
              <h2 className="text-base font-bold text-ink-900 mb-4">Payment Method</h2>
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-ink-500">No payment methods available. Please contact support.</p>
              ) : (
                <div className="space-y-2">
                  {paymentMethods.map((pm) => (
                    <label key={pm.id} className={classNames(
                      'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors',
                      selectedMethod === pm.id ? 'border-primary-500 bg-primary-50' : 'border-ink-200 hover:border-ink-300',
                    )}>
                      <input
                        type="radio"
                        name="payment"
                        checked={selectedMethod === pm.id}
                        onChange={() => setSelectedMethod(pm.id)}
                        className="mt-1 h-4 w-4 text-primary-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-ink-900">{pm.name}</p>
                        {pm.description && <p className="text-xs text-ink-500 mt-0.5">{pm.description}</p>}
                        {pm.type === 'upi' && pm.upi_id && (
                          <p className="mt-1 text-xs text-ink-600">UPI ID: <code className="font-bold">{pm.upi_id}</code></p>
                        )}
                        {pm.type === 'cod' && (
                          <p className="mt-1 text-xs text-ink-600">Pay in cash when your order is delivered.</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {(() => {
                const pm = paymentMethods.find((m) => m.id === selectedMethod);
                if (!pm) return null;
                if (pm.type === 'upi' || pm.type === 'upi_qr') {
                  return (
                    <div className="mt-4 rounded-xl border border-primary-200 bg-primary-50 p-4">
                      {pm.upi_id && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-ink-600">UPI ID</p>
                          <div className="mt-1 flex items-center gap-2">
                            <code className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-bold">{pm.upi_id}</code>
                            <button onClick={() => { navigator.clipboard?.writeText(pm.upi_id!); toast('UPI ID copied'); }} className="rounded-lg bg-primary-600 p-2 text-white">
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      {pm.payment_qr_codes?.filter((q) => q.enabled).map((qr) => (
                        <div key={qr.id} className="mb-2">
                          <img src={qr.image_url} alt={qr.name} className="mx-auto h-40 w-40 rounded-xl bg-white object-contain" />
                        </div>
                      ))}
                      {pm.instructions && <p className="text-xs text-ink-600">{pm.instructions}</p>}
                      <p className="mt-2 text-xs font-medium text-warning-700">Click "Place Order" below, then confirm your payment. Your payment will be verified manually — it is NOT automatically marked as paid.</p>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="mt-5 flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                <Button onClick={handlePlaceOrder} loading={placing} className="flex-1">Place Order</Button>
              </div>
            </div>
          )}
        </div>

        {/* Order total sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-32 rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="text-base font-bold text-ink-900 mb-3">Price Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-600">Subtotal ({items.length} items)</span><span className="font-semibold">{formatINR(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-success-600"><span>Coupon Discount</span><span className="font-semibold">-{formatINR(discount)}</span></div>}
              <div className="flex justify-between">
                <span className="text-ink-600">Shipping</span>
                <span className="font-semibold">{shipping === 0 ? <span className="text-success-600">FREE</span> : formatINR(shipping)}</span>
              </div>
              {shipping === 0 && (
                <p className="text-xs text-success-600"><Truck className="mr-1 inline h-3 w-3" />Free shipping on all orders</p>
              )}
              <div className="border-t border-ink-100 pt-2 flex justify-between">
                <span className="font-bold text-ink-900">Total</span>
                <span className="text-lg font-extrabold text-primary-600">{formatINR(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
