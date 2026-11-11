/**
 * Motion By DK — Cashfree Checkout Modal & SDK v3 Integration
 * Seamless trial-to-paid and in-store checkout engine
 */

(function () {
  'use strict';

  var API_BASE = window.MOTIONBYDK_API_BASE || 'https://motionbydk-api-staging.motionbydk-api.workers.dev';
  var activeProductId = 'ae-workflow-pro';
  var appliedCoupon = '';
  var isSubmitting = false;

  // Dynamically load Cashfree JS SDK v3 if not present
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
                            Lifetime Commercial License
                        </div>
                        <h4 id="cfModalProductName" class="text-sm font-bold text-white">MotionByDk AE Workflow Pro</h4>
                        <span id="cfModalProductDesc" class="text-[11px] text-gray-400 block">Valid on up to 2 Personal Computers (PC + Laptop)</span>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <span id="cfModalProductPrice" class="text-xl font-black text-[#00F0FF] font-heading block">₹499</span>
                        <span id="cfModalOriginalPrice" class="text-[10px] text-gray-500 line-through block">₹999</span>
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
                    <label class="block text-xs font-semibold text-gray-300 mb-1">Mobile Number (10 digits for UPI / SMS confirmation):</label>
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-2.5 rounded-xl bg-[#0a0d14] border border-white/15 text-gray-400 text-xs sm:text-sm font-mono">+91</span>
                        <input type="tel" id="cfCustomerPhone" required maxlength="10" pattern="[0-9]{10}" placeholder="9876543210" class="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0a0d14] border border-white/15 text-white text-xs sm:text-sm font-mono focus:border-[#00F0FF] focus:outline-none">
                    </div>
                </div>

                <!-- Error Display -->
                <div id="cfCheckoutError" class="hidden p-3 rounded-lg bg-red-950/70 border border-red-500/50 text-red-200 text-xs leading-relaxed"></div>

                <!-- Submit Button -->
                <button type="submit" id="cfSubmitBtn" class="w-full py-3.5 px-4 rounded-xl bg-[#00F0FF] hover:bg-[#33F3FF] text-black font-heading font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00F0FF]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                    <svg class="w-4 h-4 fill-black" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                    <span id="cfSubmitBtnLabel">Proceed to Pay ₹499</span>
                </button>

                <!-- Supported Payment Rails -->
                <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-[10px] text-gray-400">
                    <span class="flex items-center gap-1"><span class="text-emerald-400">✓</span> UPI (GPay, PhonePe, Paytm, QR)</span>
                    <span class="flex items-center gap-1"><span class="text-emerald-400">✓</span> Debit / Credit Cards</span>
                    <span class="flex items-center gap-1"><span class="text-emerald-400">✓</span> NetBanking</span>
                </div>
            </form>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Close on backdrop click
    var modalEl = document.getElementById('cashfreeCheckoutModal');
    if (modalEl) {
      modalEl.addEventListener('click', function (e) {
        if (e.target === modalEl) window.closeCashfreeModal();
      });
    }
  }

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

    var nameEl = document.getElementById('cfModalProductName');
    var descEl = document.getElementById('cfModalProductDesc');
    var priceEl = document.getElementById('cfModalProductPrice');
    var origEl = document.getElementById('cfModalOriginalPrice');
    var btnLabel = document.getElementById('cfSubmitBtnLabel');
    var errEl = document.getElementById('cfCheckoutError');
    if (errEl) errEl.classList.add('hidden');

    // Update pricing based on product
    if (activeProductId === 'ae-workflow-pro') {
      if (nameEl) nameEl.innerText = 'MotionByDk AE Workflow Pro';
      if (descEl) descEl.innerText = 'Valid on up to 2 Personal Computers (PC + Laptop)';
      if (origEl) origEl.innerText = '₹999';
    }

    if (initialCoupon) {
      var couponInput = document.getElementById('cfModalCouponInput');
      if (couponInput) couponInput.value = initialCoupon.trim().toUpperCase();
      window.applyModalCoupon();
    } else {
      var currentPrice = appliedCoupon === 'FIRST100' ? '₹399' : '₹499';
      if (priceEl) priceEl.innerText = currentPrice;
      if (btnLabel) btnLabel.innerText = 'Proceed to Pay ' + currentPrice;
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
  window.applyModalCoupon = function () {
    var input = document.getElementById('cfModalCouponInput');
    var msg = document.getElementById('cfModalCouponMsg');
    var priceEl = document.getElementById('cfModalProductPrice');
    var btnLabel = document.getElementById('cfSubmitBtnLabel');
    var val = (input ? input.value : '').trim().toUpperCase();

    if (val === 'FIRST100') {
      appliedCoupon = 'FIRST100';
      if (msg) {
        msg.className = 'text-[11px] text-emerald-400 font-bold block';
        msg.innerText = '✓ FIRST100 Applied! ₹100 Discount added (Final: ₹399).';
      }
      if (priceEl) priceEl.innerText = '₹399';
      if (btnLabel) btnLabel.innerText = 'Proceed to Pay ₹399';
    } else if (!val) {
      appliedCoupon = '';
      if (msg) msg.className = 'hidden';
      if (priceEl) priceEl.innerText = '₹499';
      if (btnLabel) btnLabel.innerText = 'Proceed to Pay ₹499';
    } else {
      appliedCoupon = '';
      if (msg) {
        msg.className = 'text-[11px] text-red-400 font-bold block';
        msg.innerText = 'Coupon "' + val + '" is invalid or expired.';
      }
      if (priceEl) priceEl.innerText = '₹499';
      if (btnLabel) btnLabel.innerText = 'Proceed to Pay ₹499';
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
    var customerPhone = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '').slice(-10) : '';

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

    if (customerPhone.length !== 10) {
      if (errEl) {
        errEl.innerText = 'Please enter a valid 10-digit mobile number.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    isSubmitting = true;
    if (btn) btn.disabled = true;
    if (btnLabel) btnLabel.innerText = 'Connecting to Cashfree Payments...';

    try {
      var res = await fetch(API_BASE + '/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: activeProductId,
          customerName: customerName,
          customerEmail: customerEmail,
          customerPhone: customerPhone,
          couponCode: appliedCoupon || undefined,
        }),
      });

      var data = await res.json();

      if (res.ok && data.success && data.paymentSessionId) {
        // Save email in in-memory sessionStorage (never in URL) for seamless claim on activate.html
        try {
          sessionStorage.setItem('checkout_email', customerEmail);
        } catch (e) {}

        // Close our form modal
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
          // If SDK failed to load, redirect directly
          window.location.href = 'activate.html?order_id=' + encodeURIComponent(data.orderId);
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
      var curPrice = appliedCoupon === 'FIRST100' ? '₹399' : '₹499';
      if (btnLabel) btnLabel.innerText = 'Proceed to Pay ' + curPrice;
    }
  };

  // Intercept and handle global primary buy triggers
  var originalPrimaryBuy = window.handlePrimaryBuy;
  window.handlePrimaryBuy = function () {
    if (window.currentCurrency === 'INR' || !window.currentCurrency) {
      window.openCashfreeModal('ae-workflow-pro');
    } else if (typeof originalPrimaryBuy === 'function') {
      originalPrimaryBuy();
    } else {
      window.open('https://gumroad.com/l/bbpskg', '_blank');
    }
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
