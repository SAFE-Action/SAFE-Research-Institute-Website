/* ============================================
   SAFE Research Institute - Donate Page
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // --- Elements ---
  const freqBtns = document.querySelectorAll('.donate-freq-btn');
  const amountBtns = document.querySelectorAll('.donate-amount-btn');
  const customInput = document.getElementById('customAmount');
  const freqLabel = document.getElementById('donateFreqLabel');
  const amountLabel = document.getElementById('donateAmountLabel');
  const donateBtn = document.getElementById('donateBtn');

  if (!donateBtn) return;

  let selectedFrequency = 'one-time';
  let selectedAmount = 100;

  // --- Stripe Payment Links (placeholder until Stripe is set up) ---
  // Replace these with real Stripe Payment Links from your dashboard.
  // Create one link per amount+frequency combination, or use a single
  // link with open amount enabled.
  const stripeLinks = {
    'one-time': {
      25: '#',
      50: '#',
      100: '#',
      250: '#',
      500: '#',
      custom: '#'
    },
    'monthly': {
      25: '#',
      50: '#',
      100: '#',
      250: '#',
      500: '#',
      custom: '#'
    }
  };

  function updateSummary() {
    freqLabel.textContent = selectedFrequency === 'monthly' ? 'monthly' : 'one-time';
    amountLabel.textContent = selectedAmount || '—';

    // Update donate button href
    const links = stripeLinks[selectedFrequency];
    const link = links[selectedAmount] || links.custom || '#';
    donateBtn.href = link;
  }

  // --- Frequency Toggle ---
  freqBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      freqBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFrequency = btn.dataset.frequency;
      updateSummary();
    });
  });

  // --- Preset Amount Buttons ---
  amountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      amountBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAmount = parseInt(btn.dataset.amount);
      customInput.value = '';
      updateSummary();
    });
  });

  // --- Custom Amount Input ---
  customInput.addEventListener('focus', () => {
    amountBtns.forEach(b => b.classList.remove('active'));
  });

  customInput.addEventListener('input', () => {
    amountBtns.forEach(b => b.classList.remove('active'));
    const val = parseInt(customInput.value);
    selectedAmount = val > 0 ? val : 0;
    updateSummary();
  });

  // --- Donate Button Click ---
  donateBtn.addEventListener('click', (e) => {
    if (donateBtn.href === '#' || donateBtn.href.endsWith('#')) {
      e.preventDefault();
      alert('Stripe payment links are not yet configured. Please check back soon or mail a check to support our mission.');
    }
  });

  // Initialize
  updateSummary();
});
