/**
 * Motion By DK — Native Multi-Currency Cashfree Checkout Modal & SDK v3 Integration
 * Domestic & International checkout engine (Zero Gumroad, Zero Manual UPI)
 */

(function () {
  'use strict';

  function resolveApiBase() {
    if (typeof window !== 'undefined' && window.MOTIONBYDK_API_BASE) {
      return window.MOTIONBYDK_API_BASE;
    }
    if (typeof window !== 'undefined' && window.MOTIONBYDK_CONFIG && window.MOTIONBYDK_CONFIG.apiBase) {
      return window.MOTIONBYDK_CONFIG.apiBase;
    }
    var host = (typeof window !== 'undefined' && window.location && window.location.hostname)
      ? window.location.hostname.toLowerCase()
      : '';
    var isProdDomain = host === 'www.motionbydk.in' || host === 'motionbydk.in';
    if (isProdDomain) {
      return 'https://motionbydk-api.motionbydk-api.workers.dev';
    }
    return 'https://motionbydk-api-staging.motionbydk-api.workers.dev';
  }

  var API_BASE = resolveApiBase();
  if (typeof window !== 'undefined') {
    window.MDK_API_BASE = API_BASE;
  }
  var activeProductId = 'ae-workflow-pro';
  var activeProductData = null;
  var appliedCoupon = '';
  var appliedCouponData = null;
  var isSubmitting = false;

  async function apiFetch(endpoint, options) {
    try {
      var res = await fetch(API_BASE + endpoint, options);
      if (res.status >= 200 && res.status < 500) return res;
      throw new Error('Primary API HTTP ' + res.status);
    } catch (err) {
      var fallbackUrl = 'https://motionbydk-api.motionbydk-api.workers.dev';
      if (API_BASE !== fallbackUrl) {
        console.warn('[Checkout] Primary API unreachable, attempting direct production worker fallback...');
        return await fetch(fallbackUrl + endpoint, options);
      }
      throw err;
    }
  }

  // Active Currency Helper
  function getActiveCurrency() {
    if (typeof window !== 'undefined' && window.currentCurrency) {
      return window.currentCurrency;
    }
    try {
      var saved = localStorage.getItem('mdk_currency');
      if (saved === 'USD' || saved === 'INR') return saved;
    } catch (e) {}
    return 'INR';
  }

  // Load Cashfree JS SDK v3
  function loadCashfreeSDK(callback) {
    if (typeof window.Cashfree !== 'undefined') {
      if (callback) callback();
      return;
    }
    var existing = document.querySelector('script[src*="cashfree.com/js/v3/cashfree.js"]');
    if (existing) {
      existing.addEventListener('load', function () {
        if (callback) callback();
      });
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = function () {
      if (callback) callback();
    };
    document.head.appendChild(script);
  }

  // Inject Modal HTML into the DOM
  function injectModalHTML() {
    if (document.getElementById('cashfreeCheckoutModal')) return;

    var modalHtml = `
    <div id="cashfreeCheckoutModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md opacity-0 pointer-events-none transition-all duration-300">
        <div class="relative w-full max-w-lg bg-[#131822] border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8 max-h-[92vh] overflow-y-auto transform scale-95 transition-all duration-300">
            <!-- Close Button -->
            <button type="button" onclick="window.closeCashfreeModal()" class="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer" aria-label="Close modal">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <!-- Modal Header -->
            <div class="flex items-center gap-3 mb-5">
                <div class="w-10 h-10 rounded-xl bg-[#00F0FF]/15 border border-[#00F0FF]/40 flex items-center justify-center text-[#00F0FF] font-black text-sm">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                </div>
                <div>
                    <h3 class="font-heading font-black text-xl text-white tracking-tight">Instant Secure Checkout</h3>
                    <p class="text-[11px] text-gray-400">Powered by Cashfree Payments • 256-Bit SSL Encrypted</p>
                </div>
            </div>

            <!-- Product Card -->
            <div class="p-4 rounded-xl bg-[#0a0d14] border border-white/10 mb-4 space-y-3">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] text-[10px] font-bold uppercase tracking-wider mb-1">
                            Lifetime Commercial License (2-PC)
                        </div>
                        <h4 id="cfModalProductName" class="text-sm font-bold text-white">MotionByDk AE Workflow Pro</h4>
                        <span id="cfModalProductDesc" class="text-[11px] text-gray-400 block">Valid on up to 2 Personal Computers (PC + Laptop)</span>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <span id="cfModalProductPrice" class="text-xl font-black text-[#00F0FF] font-heading block">₹499</span>
                        <span id="cfModalOriginalPrice" class="text-[10px] text-gray-500 line-through block">₹999</span>
                    </div>
                </div>

                <!-- Currency Switcher Row inside Modal -->
                <div class="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                    <span class="text-gray-400">Billing Currency:</span>
                    <div class="inline-flex rounded-lg bg-[#131822] p-0.5 border border-white/10">
                        <button type="button" id="cfModalCurrInr" onclick="window.setModalCurrency('INR')" class="px-2.5 py-1 rounded text-xs font-bold transition-all text-[#00F0FF] bg-[#00F0FF]/10">₹ INR</button>
                        <button type="button" id="cfModalCurrUsd" onclick="window.setModalCurrency('USD')" class="px-2.5 py-1 rounded text-xs font-bold transition-all text-gray-400 hover:text-white">$ USD</button>
                    </div>
                </div>

                <!-- Coupon Row -->
                <div class="pt-2 border-t border-white/5 space-y-1.5">
                    <div class="flex items-center gap-2">
                        <input type="text" id="cfModalCouponInput" placeholder="Coupon Code (e.g. FIRST100)" class="flex-1 px-3 py-2 rounded-lg bg-[#131822] border border-white/15 text-white text-xs font-mono uppercase focus:border-[#00F0FF] focus:outline-none">
                        <button type="button" onclick="window.applyModalCoupon()" class="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer">Apply</button>
                    </div>
                    <div id="cfModalCouponMsg" class="hidden text-[11px]"></div>
                </div>
            </div>

            <!-- Customer Details Form -->
            <form id="cashfreeCheckoutForm" onsubmit="window.handleCashfreeSubmit(event)" class="space-y-3.5">
                <div>
                    <label class="block text-xs font-semibold text-gray-300 mb-1">Your Full Name:</label>
                    <input type="text" id="cfCustomerName" required placeholder="e.g. Dhananjay Kumar" class="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0d14] border border-white/15 text-white text-xs sm:text-sm focus:border-[#00F0FF] focus:outline-none">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-300 mb-1">Email Address (For Key &amp; Download Delivery):</label>
                    <input type="email" id="cfCustomerEmail" required placeholder="e.g. editor@gmail.com" class="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0d14] border border-white/15 text-white text-xs sm:text-sm focus:border-[#00F0FF] focus:outline-none">
                    <span class="block text-[10px] text-gray-500 mt-1">Your official activation key will be delivered to this verified email.</span>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-300 mb-1">Mobile Number (For order confirmation):</label>
                    <div class="flex items-center gap-2">
                        <span id="cfPhonePrefix" class="px-3 py-2.5 rounded-xl bg-[#0a0d14] border border-white/15 text-gray-400 text-xs sm:text-sm font-mono">+91</span>
                        <input type="tel" id="cfCustomerPhone" required maxlength="15" placeholder="9876543210" class="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0a0d14] border border-white/15 text-white text-xs sm:text-sm font-mono focus:border-[#00F0FF] focus:outline-none">
                    </div>
                </div>

                <!-- Error / Gateway Fallback Display -->
                <div id="cfCheckoutError" class="hidden p-3.5 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs leading-relaxed space-y-2"></div>

                <!-- Submit Button -->
                <button type="submit" id="cfSubmitBtn" class="w-full py-3.5 px-4 rounded-xl bg-[#00F0FF] hover:bg-[#33F3FF] text-black font-heading font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00F0FF]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                    <svg class="w-4 h-4 fill-black" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                    <span id="cfSubmitBtnLabel">Proceed to Pay</span>
                </button>

                <!-- Supported Payment Rails -->
                <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-[10px] text-gray-400">
                    <span class="flex items-center gap-1"><span class="text-emerald-400">✓</span> UPI (GPay, PhonePe, Paytm, QR)</span>
                    <span class="flex items-center gap-1"><span class="text-emerald-400">✓</span> Cards (Visa, Mastercard, RuPay)</span>
                    <span class="flex items-center gap-1"><span class="text-emerald-400">✓</span> NetBanking</span>
                </div>
            </form>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modalEl = document.getElementById('cashfreeCheckoutModal');
    if (modalEl) {
      modalEl.addEventListener('click', function (e) {
        if (e.target === modalEl) window.closeCashfreeModal();
      });
    }
  }

  // Calculate pricing based on active currency & coupon
  function getComputedPrice() {
    var curr = getActiveCurrency();
    var isUsd = curr === 'USD';

    // Base prices dynamically derived from activeProductData
    var basePrice = 499;
    var origPrice = 999;

    if (activeProductData) {
      if (isUsd) {
        basePrice = (activeProductData.price_usd !== undefined && activeProductData.price_usd !== null) ? Number(activeProductData.price_usd) : 15;
      } else {
        basePrice = activeProductData.price_inr ? Math.round(activeProductData.price_inr / 100) : 499;
      }
      origPrice = Math.round(basePrice * 2);
    } else {
      basePrice = isUsd ? 15 : 499;
      origPrice = isUsd ? 30 : 999;
    }

    var discount = 0;

    if (appliedCouponData && appliedCouponData.valid && appliedCouponData.code === appliedCoupon) {
      if (appliedCouponData.discountType === 'PERCENTAGE' && appliedCouponData.discountPercentage) {
        discount = Math.round((basePrice * appliedCouponData.discountPercentage) / 100 * 100) / 100;
      } else if (isUsd) {
        discount = appliedCouponData.discountUsd || (appliedCouponData.discountAmount && appliedCouponData.currency === 'USD' ? appliedCouponData.discountAmount : 3);
      } else {
        discount = appliedCouponData.discountInr ? Math.round(appliedCouponData.discountInr / 100) : (appliedCouponData.discountAmount || 0);
      }
    } else if (appliedCoupon === 'FIRST100' && (!activeProductData || activeProductData.allow_coupons !== 0)) {
      discount = isUsd ? 3 : 100;
    } else if (appliedCoupon === 'SAVE20' && (!activeProductData || activeProductData.allow_coupons !== 0)) {
      discount = Math.round(basePrice * 0.20 * 100) / 100;
    }

    var finalPrice = Math.max(1, basePrice - discount);
    return {
      currency: curr,
      symbol: isUsd ? '$' : '₹',
      basePrice: basePrice,
      origPrice: origPrice,
      discount: discount,
      finalPrice: finalPrice,
      formattedFinal: (isUsd ? '$' : '₹') + (isUsd ? finalPrice.toFixed(2) : (finalPrice % 1 === 0 ? finalPrice.toFixed(0) : finalPrice.toFixed(2))),
      formattedOrig: (isUsd ? '$' : '₹') + (isUsd ? origPrice.toFixed(2) : origPrice.toFixed(0)),
    };
  }

  function updateModalPricingDisplay() {
    var p = getComputedPrice();
    var priceEl = document.getElementById('cfModalProductPrice');
    var origEl = document.getElementById('cfModalOriginalPrice');
    var btnLabel = document.getElementById('cfSubmitBtnLabel');
    var prefixEl = document.getElementById('cfPhonePrefix');
    var inrBtn = document.getElementById('cfModalCurrInr');
    var usdBtn = document.getElementById('cfModalCurrUsd');

    if (priceEl) priceEl.innerText = p.formattedFinal;
    if (origEl) origEl.innerText = p.formattedOrig;
    if (btnLabel) btnLabel.innerText = 'Proceed to Pay ' + p.formattedFinal;

    if (prefixEl) {
      prefixEl.innerText = p.currency === 'INR' ? '+91' : '+';
    }

    if (inrBtn && usdBtn) {
      if (p.currency === 'INR') {
        inrBtn.className = 'px-2.5 py-1 rounded text-xs font-bold transition-all text-[#00F0FF] bg-[#00F0FF]/10';
        usdBtn.className = 'px-2.5 py-1 rounded text-xs font-bold transition-all text-gray-400 hover:text-white';
      } else {
        usdBtn.className = 'px-2.5 py-1 rounded text-xs font-bold transition-all text-[#00F0FF] bg-[#00F0FF]/10';
        inrBtn.className = 'px-2.5 py-1 rounded text-xs font-bold transition-all text-gray-400 hover:text-white';
      }
    }
  }

  function applyProductToModal(prod) {
    if (!prod) return;
    activeProductData = prod;
    var nameEl = document.getElementById('cfModalProductName');
    var descEl = document.getElementById('cfModalProductDesc');
    var couponInput = document.getElementById('cfModalCouponInput');
    var couponMsg = document.getElementById('cfModalCouponMsg');

    if (nameEl) nameEl.innerText = prod.name || ('MotionByDk ' + prod.id);
    if (descEl) descEl.innerText = prod.description || ('Commercial License (' + (prod.max_devices || 2) + '-PC)');

    if (prod.allow_coupons === 0) {
      if (couponInput) {
        couponInput.disabled = true;
        couponInput.placeholder = 'Coupons not applicable';
        couponInput.value = '';
      }
      appliedCoupon = '';
      appliedCouponData = null;
      if (couponMsg) {
        couponMsg.className = 'text-[11px] text-amber-400 font-semibold block';
        couponMsg.innerText = 'Fixed-price product: coupons disabled.';
      }
    } else {
      if (couponInput) {
        couponInput.disabled = false;
        couponInput.placeholder = 'Coupon Code (e.g. FIRST100)';
      }
    }
    updateModalPricingDisplay();
  }

  // Switch modal currency
  window.setModalCurrency = function (curr) {
    if (curr !== 'INR' && curr !== 'USD') return;
    window.currentCurrency = curr;
    try {
      localStorage.setItem('mdk_currency', curr);
    } catch (e) {}

    // Synchronize page-level currency if function exists
    if (typeof window.applyCurrencyUI === 'function') {
      window.applyCurrencyUI();
    }
    if (appliedCoupon) {
      window.applyModalCoupon();
    } else {
      updateModalPricingDisplay();
    }
  };

  // Open the Cashfree Checkout Modal
  window.openCashfreeModal = function (productId, initialCoupon) {
    loadCashfreeSDK();
    injectModalHTML();

    if (!productId || productId === 'plugin' || productId === 'mdk-ae-workflow-pro') {
      productId = 'ae-workflow-pro';
    }
    activeProductId = productId;

    var modal = document.getElementById('cashfreeCheckoutModal');
    if (!modal) return;

    var errEl = document.getElementById('cfCheckoutError');
    if (errEl) errEl.classList.add('hidden');

    // Look up product in catalog cache or fetch from API
    var found = (window.mdkProductsCatalog || []).find(function (p) { return p.id === productId; });
    if (found) {
      applyProductToModal(found);
    } else {
      fetch(API_BASE + '/api/products/' + encodeURIComponent(productId))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.success && data.product) {
            applyProductToModal(data.product);
          }
        })
        .catch(function () {});
    }

    if (initialCoupon) {
      var couponInput = document.getElementById('cfModalCouponInput');
      if (couponInput) couponInput.value = initialCoupon.trim().toUpperCase();
      window.applyModalCoupon();
    } else {
      updateModalPricingDisplay();
    }

    modal.classList.remove('opacity-0', 'pointer-events-none');
    var box = modal.querySelector('div');
    if (box) {
      box.classList.remove('scale-95');
      box.classList.add('scale-100');
    }
    document.body.classList.add('overflow-hidden');
  };

  // Close the Cashfree Checkout Modal
  window.closeCashfreeModal = function () {
    var modal = document.getElementById('cashfreeCheckoutModal');
    if (!modal) return;
    modal.classList.add('opacity-0', 'pointer-events-none');
    var box = modal.querySelector('div');
    if (box) {
      box.classList.add('scale-95');
      box.classList.remove('scale-100');
    }
    document.body.classList.remove('overflow-hidden');
  };

  // Apply Coupon inside Modal
  window.applyModalCoupon = async function () {
    var input = document.getElementById('cfModalCouponInput');
    var msg = document.getElementById('cfModalCouponMsg');
    var val = (input ? input.value : '').trim().toUpperCase();

    if (!val) {
      appliedCoupon = '';
      appliedCouponData = null;
      if (msg) msg.className = 'hidden';
      updateModalPricingDisplay();
      return;
    }

    if (msg) {
      msg.className = 'text-[11px] text-gray-400 font-bold block';
      msg.innerText = 'Checking coupon...';
    }

    try {
      var curr = getActiveCurrency();
      var res = await apiFetch('/api/checkout/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: val,
          productId: activeProductId || 'ae-workflow-pro',
          currency: curr,
        }),
      });

      var data = await res.json();
      if (data && data.valid) {
        appliedCoupon = data.code;
        appliedCouponData = data;
        updateModalPricingDisplay();
        var p = getComputedPrice();
        if (msg) {
          msg.className = 'text-[11px] text-emerald-400 font-bold block';
          msg.innerText = data.message || ('✓ ' + data.code + ' Applied! Payable: ' + p.formattedFinal);
        }
      } else {
        appliedCoupon = '';
        appliedCouponData = null;
        updateModalPricingDisplay();
        if (msg) {
          msg.className = 'text-[11px] text-red-400 font-bold block';
          msg.innerText = (data && data.message) ? data.message : ('Coupon "' + val + '" is invalid or expired.');
        }
      }
    } catch (err) {
      // Offline fallback
      if (val === 'FIRST100') {
        appliedCoupon = 'FIRST100';
        appliedCouponData = { valid: true, code: 'FIRST100', discountType: 'FIXED', discountInr: 10000, discountUsd: 3 };
        updateModalPricingDisplay();
        var p1 = getComputedPrice();
        if (msg) {
          msg.className = 'text-[11px] text-emerald-400 font-bold block';
          msg.innerText = '✓ FIRST100 Applied! Payable: ' + p1.formattedFinal;
        }
      } else if (val === 'SAVE20') {
        appliedCoupon = 'SAVE20';
        appliedCouponData = { valid: true, code: 'SAVE20', discountType: 'PERCENTAGE', discountPercentage: 20 };
        updateModalPricingDisplay();
        var p2 = getComputedPrice();
        if (msg) {
          msg.className = 'text-[11px] text-emerald-400 font-bold block';
          msg.innerText = '✓ SAVE20 Applied! Payable: ' + p2.formattedFinal;
        }
      } else {
        appliedCoupon = '';
        appliedCouponData = null;
        updateModalPricingDisplay();
        if (msg) {
          msg.className = 'text-[11px] text-red-400 font-bold block';
          msg.innerText = 'Coupon "' + val + '" is invalid or expired.';
        }
      }
    }
  };

  // Handle Form Submission & Cashfree Checkout Initialization
  window.handleCashfreeSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;

    var nameInput = document.getElementById('cfCustomerName');
    var emailInput = document.getElementById('cfCustomerEmail');
    var phoneInput = document.getElementById('cfCustomerPhone');
    var btn = document.getElementById('cfSubmitBtn');
    var btnLabel = document.getElementById('cfSubmitBtnLabel');
    var errEl = document.getElementById('cfCheckoutError');

    var customerName = nameInput ? nameInput.value.trim() : '';
    var customerEmail = emailInput ? emailInput.value.trim().toLowerCase() : '';
    var rawPhone = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '') : '';
    var customerPhone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;

    if (errEl) errEl.classList.add('hidden');

    if (!customerName || customerName.length < 2) {
      if (errEl) {
        errEl.innerText = 'Please enter your full name.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerEmail || !emailPattern.test(customerEmail)) {
      if (errEl) {
        errEl.innerText = 'Please enter a valid email address.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (customerPhone.length < 7) {
      if (errEl) {
        errEl.innerText = 'Please enter a valid mobile number.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    isSubmitting = true;
    if (btn) btn.disabled = true;
    if (btnLabel) btnLabel.innerText = 'Connecting to Cashfree Payments...';

    var curr = getActiveCurrency();

    try {
      var res = await apiFetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: activeProductId,
          customerName: customerName,
          customerEmail: customerEmail,
          customerPhone: customerPhone,
          currency: curr,
          couponCode: appliedCoupon || undefined,
        }),
      });

      var data = await res.json();

      if (res.ok && data.success && data.paymentSessionId) {
        try {
          sessionStorage.setItem('checkout_email', customerEmail);
        } catch (e) {}

        window.closeCashfreeModal();

        // Launch Cashfree SDK v3 Modal
        if (typeof window.Cashfree !== 'undefined') {
          var cashfree = window.Cashfree({
            mode: data.mode === 'production' ? 'production' : 'sandbox',
          });

          cashfree
            .checkout({
              paymentSessionId: data.paymentSessionId,
              redirectTarget: '_modal',
            })
            .then(function (result) {
              if (result.error) {
                alert(result.error.message || 'Payment was cancelled or failed.');
              }
              if (result.paymentDetails || result.redirect) {
                window.location.href = 'activate.html?order_id=' + encodeURIComponent(data.orderId);
              }
            });
        } else {
          window.location.href = 'activate.html?order_id=' + encodeURIComponent(data.orderId);
        }
      } else if (data.error === 'INTERNATIONAL_PAYMENT_PENDING') {
        // Graceful international USD fallback to INR checkout
        if (errEl) {
          errEl.innerHTML = `
            <div class="space-y-2">
                <span class="font-bold text-amber-300 block">International Payment Notice</span>
                <p class="text-amber-200">${data.message || 'Direct USD checkout is pending verification. You can complete your order in INR using any international credit or debit card.'}</p>
                <button type="button" onclick="window.switchCurrencyAndPayInr()" class="w-full py-2.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs transition-colors">
                    Switch to INR (₹499) &amp; Proceed Instantly
                </button>
            </div>
          `;
          errEl.classList.remove('hidden');
        }
      } else {
        var msg = data.message || 'Unable to initialize checkout session. Please try again.';
        if (errEl) {
          errEl.innerText = msg;
          errEl.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (errEl) {
        errEl.innerText = 'Network error while contacting payment gateway. Please check your internet connection.';
        errEl.classList.remove('hidden');
      }
    } finally {
      isSubmitting = false;
      if (btn) btn.disabled = false;
      updateModalPricingDisplay();
    }
  };

  window.switchCurrencyAndPayInr = function () {
    window.setModalCurrency('INR');
    var errEl = document.getElementById('cfCheckoutError');
    if (errEl) errEl.classList.add('hidden');
    window.handleCashfreeSubmit();
  };

  // Intercept and handle global primary buy triggers
  window.handlePrimaryBuy = function () {
    window.openCashfreeModal('ae-workflow-pro');
  };

  // Global event delegation for buy triggers
  document.addEventListener('click', function (e) {
    var target = e.target && e.target.closest ? e.target.closest('[data-cashfree-checkout]') : null;
    if (target) {
      e.preventDefault();
      var prod = target.getAttribute('data-product-id') || 'ae-workflow-pro';
      var coupon = target.getAttribute('data-coupon') || '';
      window.openCashfreeModal(prod, coupon);
    }
  });

  // Keyboard navigation: Close on ESC
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      window.closeCashfreeModal();
    }
  });

  // URL parameter triggers: ?buy=plugin or ?ref=ae_trial or ?coupon=FIRST100
  document.addEventListener('DOMContentLoaded', function () {
    loadCashfreeSDK();
    injectModalHTML();

    var params = new URLSearchParams(window.location.search);
    var buyParam = params.get('buy');
    var refParam = params.get('ref');
    var couponParam = params.get('coupon');

    if (buyParam === 'plugin' || buyParam === 'ae-workflow-pro' || refParam === 'ae_trial') {
      setTimeout(function () {
        window.openCashfreeModal('ae-workflow-pro', couponParam);
      }, 300);
    }
  });
})();
